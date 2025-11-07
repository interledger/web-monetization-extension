import React from 'react';
import { Switch } from '@/pages/shared/components/ui/Switch';
import { dispatch, usePopupState } from '@/popup/lib/store';
import { useMessage } from '@/popup/lib/context';
import { useTelemetry } from '@/pages/shared/lib/context';

export function SettingsScreen() {
  const message = useMessage();
  const { consentTelemetry = false } = usePopupState();
  const telemetry = useTelemetry();

  return (
    <Switch
      label="Telemetry"
      checked={consentTelemetry}
      onChange={async (ev) => {
        const isOptedIn = ev.currentTarget.checked;
        await message.send('OPT_IN_OUT_TELEMETRY', { isOptedIn });
        dispatch({ type: 'OPT_IN_OUT_TELEMETRY', data: { isOptedIn } });
        telemetry.optInOut(isOptedIn);
      }}
    />
  );
}
