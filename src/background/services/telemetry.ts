import { PostHog } from 'posthog-js/dist/module.no-external';
import { POSTHOG_HOST, POSTHOG_KEY } from '@/shared/defines';
import type { Cradle } from '@/background/container';

export class Telemetry {
  private storage: Cradle['storage'];
  private posthog: PostHog;

  constructor({ storage }: Cradle) {
    Object.assign(this, { storage });
    this.posthog = new PostHog();
  }

  async start() {
    const { consentTelemetry, uid } = await this.storage.get([
      'consentTelemetry',
      'uid',
    ]);
    // While consentTelemetry is undefined or false, we won't capture data.
    const opt_out_capturing_by_default = consentTelemetry !== true;
    this.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      opt_out_capturing_by_default,
      bootstrap: {
        distinctID: uid,
        // Prevent fetching feature flags.
        featureFlags: {},
        featureFlagPayloads: {},
        // We don't identify users, so marks as identified to avoid API requests.
        isIdentifiedID: true,
      },
      persistence: 'memory',
      disable_external_dependency_loading: true,
      capture_pageview: false, // No DOM in service workers
      autocapture: false, // No DOM events to capture
      disable_session_recording: true, // No DOM to record
      disable_surveys: true, // No UI to display surveys
      // Prevent fetching flags and along with it, any remote config.
      advanced_disable_flags: true,
    });
  }

  async optInOut(isOptedIn: boolean) {
    await this.storage.set({ consentTelemetry: isOptedIn });
    if (isOptedIn) {
      this.posthog.opt_in_capturing();
    } else {
      this.posthog.opt_out_capturing();
    }
  }

  capture(...args: Parameters<PostHog['capture']>) {
    this.posthog.capture(...args);
  }

  captureException(...args: Parameters<PostHog['captureException']>) {
    this.posthog.captureException(...args);
  }
}
