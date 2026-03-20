'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ModalStep } from './tutorialSteps';
import NodeRepresentationDemo from './steps/NodeRepresentationDemo';
import NodeSizingDemo from './steps/NodeSizingDemo';

const STEPS: ModalStep[] = [
  {
    title: 'What are nodes?',
    description:
      'Every node represents one of 456 Malaysian occupations." to "Each node represents an occupation in Malaysia taken from the Malaysian Standard Classification of Occupations (MASCO) 2020.',
    component: NodeRepresentationDemo,
  },
  {
    title: 'Size of nodes',
    description:
      'The larger the node, the higher the AI exposure, as measured using the AI exposure index developed by Cheng, Chong, Dornan and Jasmin (2025)',
    component: NodeSizingDemo,
  },
];

interface TutorialModalProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export default function TutorialModal({
  open,
  onComplete,
  onSkip,
}: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];
  const StepComponent = step.component;
  const isLast = currentStep === STEPS.length - 1;

  // Reset to first step when opening
  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, onComplete]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goBack();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, goBack, goNext]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onSkip();
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={true}>
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{step.title}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Tutorial step {currentStep + 1}: {step.title}
          </DialogDescription>
        </DialogHeader>

        {/* Animation area */}
        <div className="px-6">
          <div className="rounded-md bg-muted/30 border border-border/50 overflow-hidden">
            <StepComponent key={currentStep} />
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground px-6">{step.description}</p>

        {/* Footer with dots and nav */}
        <DialogFooter className="px-6 pb-6 pt-2 flex-row items-center justify-between sm:justify-between">
          {/* Dot indicators */}
          <div
            className="flex gap-1.5"
            role="tablist"
            aria-label="Tutorial steps"
          >
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentStep}
                aria-label={`Go to step ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                onClick={() => setCurrentStep(i)}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mr-1"
            >
              Skip tutorial
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              disabled={currentStep === 0}
              aria-label="Previous step"
            >
              <ChevronLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={goNext}
              aria-label={isLast ? 'Start exploring' : 'Next step'}
            >
              {isLast ? (
                'Got it!'
              ) : (
                <>
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
