import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/App';
import { useMessage } from '@/app/lib/context';

export const Component = () => {
  const [state, setState] = React.useState({});
  const message = useMessage();
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Home</h1>
        <nav>
          <ul>
            <li>
              <Link
                className="text-blue-500 underline"
                to={ROUTES.POST_INSTALL}
              >
                Post install
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <hr />

      <button
        className="bg-primary p-2 text-white"
        onClick={async () => {
          const res = await message.send('GET_DATA');
          setState(res);
        }}
      >
        Get data
      </button>
      <pre>State: {JSON.stringify(state, null, 2)}</pre>
    </div>
  );
};
