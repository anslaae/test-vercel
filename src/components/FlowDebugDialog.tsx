import React from 'react';

export interface DebugDetail {
  label: string;
  value: string;
}

interface FlowDebugDialogProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  details?: DebugDetail[];
  onContinue: () => void;
}

const FlowDebugDialog: React.FC<FlowDebugDialogProps> = ({
  step,
  totalSteps,
  title,
  description,
  details,
  onContinue
}) => {
  return (
    <div className="debug-overlay">
      <div className="debug-dialog">
        <div className="debug-step-badge">
          Step {step} of {totalSteps}
        </div>
        <h2 className="debug-title">{title}</h2>
        <p className="debug-description">{description}</p>
        {details && details.length > 0 && (
          <div className="debug-details">
            {details.map(({ label, value }) => (
              <div key={label} className="debug-detail-row">
                <span className="debug-detail-label">{label}</span>
                <span className="debug-detail-value">{value}</span>
              </div>
            ))}
          </div>
        )}
        <button className="login-button primary-button debug-continue-btn" onClick={onContinue}>
          Continue →
        </button>
      </div>
    </div>
  );
};

export default FlowDebugDialog;

