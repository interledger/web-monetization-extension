"""Load the extension in Safari with safaridriver and check the popup.

Usage: python3 safari.py [path/to/dist/safari]
"""

import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

DIST = sys.argv[1] if len(sys.argv) > 1 else 'dist/safari'
PORT = 4445
POPUP_TEXT = 'return document.body.innerText.replace(/\\s+/g, " ").slice(0, 160)'


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        f'http://127.0.0.1:{PORT}{path}',
        method=method,
        data=data,
        headers={'content-type': 'application/json'},
    )
    try:
        return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'body': json.loads(e.read() or b'{}')}


def screenshot(sid, name):
    png = req('GET', f'/session/{sid}/screenshot')['value']
    with open(name, 'wb') as f:
        f.write(base64.b64decode(png))


driver = subprocess.Popen(['safaridriver', '-p', str(PORT)])
time.sleep(2)
sid = None
try:
    caps = {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}}
    sid = req('POST', '/session', caps)['value']['sessionId']
    s = f'/session/{sid}'

    # Not in the WebDriver spec, but safaridriver supports it since Safari 26.
    install = {'type': 'path', 'path': DIST}
    print('install:', req('POST', f'{s}/webextension', install))
    time.sleep(3)

    # The background script opens the post-install consent page, which gives
    # us the safari-web-extension://<uuid> base URL.
    base = None
    for handle in req('GET', f'{s}/window/handles')['value']:
        req('POST', f'{s}/window', {'handle': handle})
        url = req('GET', f'{s}/url')['value']
        if url.startswith('safari-web-extension://'):
            base = '/'.join(url.split('/')[:3])
            break
    if not base:
        sys.exit('extension page not found')
    screenshot(sid, 'safari-consent.png')

    req('POST', f'{s}/url', {'url': f'{base}/popup/index.html'})
    time.sleep(3)
    print('popup:', req('POST', f'{s}/execute/sync', {'script': POPUP_TEXT, 'args': []}))
    screenshot(sid, 'safari-popup.png')

    # Fails with "Must be called during a user gesture".
    request = '''
      const done = arguments[0]
      browser.permissions.request({ origins: ['<all_urls>'] })
        .then((granted) => done('granted: ' + granted), (e) => done(e.message))
    '''
    print('permissions.request:', req('POST', f'{s}/execute/async', {'script': request, 'args': []}))

    # A WebDriver click doesn't count as a user gesture either.
    xpath = "//button[contains(., 'Grant permission')]"
    button = req('POST', f'{s}/element', {'using': 'xpath', 'value': xpath})['value']
    element = list(button.values())[0]
    print('click:', req('POST', f'{s}/element/{element}/click', {}))
    time.sleep(5)
    contains = "browser.permissions.contains({ origins: ['<all_urls>'] }).then(arguments[0])"
    print('permissions.contains:', req('POST', f'{s}/execute/async', {'script': contains, 'args': []}))
finally:
    if sid:
        req('DELETE', f'/session/{sid}')
    driver.terminate()
