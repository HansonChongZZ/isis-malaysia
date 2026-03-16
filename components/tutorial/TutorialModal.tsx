'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { TutorialStep } from './tutorialSteps';
import NodeRepresentationDemo from './steps/NodeRepresentationDemo';
import NodeArrangementDemo from './steps/NodeArrangementDemo';
import NodeSizingDemo from './steps/NodeSizingDemo';
import HoverBehaviourDemo from './steps/HoverBehaviourDemo';
import ClickBehaviourDemo from './steps/ClickBehaviourDemo';

const STEPS: TutorialStep[] = [
  {
    title: 'Each circle is an occupation',
    description:
      'Every node represents one of 456 Malaysian occupations. Larger nodes have higher AI exposure.',
    component: NodeRepresentationDemo,
  },
  {
    title: 'Similar skills cluster together',
    description:
      'Occupations sharing similar skills are positioned closer together, forming natural clusters.',
    component: NodeArrangementDemo,
  },
  {
    title: 'Size shows AI exposure',
    description:
      'Larger circles indicate higher AI exposure or median wage. Use the toggle to switch between metrics.',
    component: NodeSizingDemo,
  },
  {
    title: 'Hover to explore connections',
    description:
      'Move your cursor over any node to see its name, AI exposure, and connected occupations.',
    component: HoverBehaviourDemo,
  },
  {
    title: 'Click for full details',
    description:
      'Click any occupation to open its detailed profile with skills, tasks, and career transition pathways.',
    component: ClickBehaviourDemo,
  },
];

interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TutorialModal({
  open,
  onOpenChange,
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
      onOpenChange(false);
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, onOpenChange]);

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

  // Memoize the step key to force remount of animation on step change
  const stepKey = useMemo(() => `step-${currentStep}`, [currentStep]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl [&>[data-slot=dialog-close]]:z-20" showCloseButton={true}>
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{step.title}</DialogTitle>
            <span className="text-xs text-muted-foreground shrink-0 ml-2">
              Step {currentStep + 1} of {STEPS.length}
            </span>
          </div>
          <DialogDescription className="sr-only">
            Tutorial step {currentStep + 1}: {step.title}
          </DialogDescription>
        </DialogHeader>

        {/* Animation area */}
        <div className="px-6">
          <div className="rounded-md bg-muted/30 border border-border/50 overflow-hidden">
            <StepComponent key={stepKey} />
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
          <div className="flex gap-2">
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
              aria-label={isLast ? 'Close tutorial' : 'Next step'}
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
