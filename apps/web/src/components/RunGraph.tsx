import type { AgentRoomGraphStep } from '../api/client';

export interface RunGraphProps {
  steps: AgentRoomGraphStep[];
}

export function RunGraph({ steps }: RunGraphProps) {
  if (steps.length === 0) {
    return <p>No workflow steps recorded.</p>;
  }

  return (
    <ol aria-label="Run graph">
      {steps.map((step) => (
        <li key={step.id}>
          <strong>{step.name}</strong>
          <span> {step.status}</span>
          {step.retryAttempt > 0 ? <span> retry {step.retryAttempt}</span> : null}
        </li>
      ))}
    </ol>
  );
}
