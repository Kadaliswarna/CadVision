import React from 'react';

interface WorkflowBarProps {
  currentStep: number;
}

export const WorkflowBar: React.FC<WorkflowBarProps> = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Physical Object + ArUco' },
    { num: 2, label: 'Camera / Upload' },
    { num: 3, label: 'OpenCV AI Vision' },
    { num: 4, label: 'CAD Intermediate' },
    { num: 5, label: 'AutoCAD DXF' },
  ];

  return (
    <div className="workflow-stepper">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className={`step-item ${currentStep >= step.num ? 'active' : ''}`}>
            <span className="step-number">{step.num}</span>
            <span>{step.label}</span>
          </div>
          {idx < steps.length - 1 && <span className="step-arrow">➔</span>}
        </React.Fragment>
      ))}
    </div>
  );
};
