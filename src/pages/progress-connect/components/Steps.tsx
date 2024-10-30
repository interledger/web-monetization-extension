import React from 'react';
import { cn } from '@/shared/helpers';
import type { StepWithStatus } from '@/content/keyAutoAdd/lib/types';

export function Steps({ steps }: { steps: StepWithStatus[] }) {
  return (
    <div className="flex w-full gap-1">
      {steps.map((step) => (
        <Step key={step.name} step={step} />
      ))}
    </div>
  );
}

function Step({ step }: { step: StepWithStatus }) {
  return (
    <div
      title={step.name}
      className={cn(
        'h-1 w-full',
        step.status === 'active' && 'animate-pulse bg-blue-400',
        step.status === 'pending' && 'bg-gray-200',
        step.status === 'success' && 'bg-green-400',
        step.status === 'skipped' && 'bg-green-200',
        step.status === 'error' && 'bg-red-400',
      )}
    />
  );
}
