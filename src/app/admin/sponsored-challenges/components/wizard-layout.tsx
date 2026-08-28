import React, { useState } from "react";

interface WizardStepProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  isActive: boolean;
  isComplete: boolean;
}

export function WizardStep({ title, description, children, isActive, isComplete }: WizardStepProps) {
  return (
    <div className={`p-4 rounded-xl ${isActive ? 'bg-surface-900 border border-primary-400/40' : 'bg-canvas-950/30 border border-line-300'} transition-all`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex size-6 items-center justify-center rounded-full text-xs font-black ${
          isComplete ? 'bg-primary-500 text-canvas-950' : 
          isActive ? 'bg-primary-500/20 text-primary-100 border border-primary-400/30' : 
          'border border-line-300 text-ink-500'
        }`}>
          {isComplete ? '✓' : <span className="text-xs">1</span>}
        </div>
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      {description && <p className="text-sm text-ink-400 mb-4">{description}</p>}
      {isActive && children}
    </div>
  );
}

interface WizardProps {
  currentStep: number;
  steps: string[];
  onStepChange: (step: number) => void;
  children: React.ReactNode;
}

export function Wizard({ currentStep, steps, onStepChange, children }: WizardProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 mb-8">
        {steps.map((step, index) => (
          <button
            key={index}
            onClick={() => onStepChange(index)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition ${
              currentStep === index 
                ? 'bg-primary-500/20 text-primary-100 border border-primary-400/30' 
                : 'text-ink-400 hover:text-white'
            }`}
          >
            <span className="font-black">{index + 1}</span>
            {step}
          </button>
        ))}
      </div>
      
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}