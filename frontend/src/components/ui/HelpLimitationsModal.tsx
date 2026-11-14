import React, { useEffect, useRef } from 'react';

interface HelpLimitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpLimitationsModal: React.FC<HelpLimitationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="bc-methodology-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="bc-methodology-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-title"
        aria-describedby="methodology-content"
      >
        <header className="bc-methodology-header">
          <h2 id="methodology-title">Methodology and limitations</h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="bc-methodology-close"
            aria-label="Close methodology"
          >
            Close
          </button>
        </header>

        <div className="bc-methodology-content" id="methodology-content">
          <section>
            <h3>Analysis workflow</h3>
            <p>
              A DNA sequence is compared with a selected reference using pairwise alignment. Coding consequences are evaluated only when coding context and reading frame are supplied.
            </p>
            <p>
              Structure mapping is attempted when the reference and available experimental data support it. An unmapped structure does not prevent sequence comparison.
            </p>
          </section>

          <section>
            <h3>Coordinate conventions</h3>
            <ul>
              <li><strong>DNA positions:</strong> One-based nucleotide positions.</li>
              <li><strong>Codon positions:</strong> Determined by the selected reading frame.</li>
              <li><strong>Structure residues:</strong> Mapped to the identifiers available in the selected experimental structure.</li>
            </ul>
          </section>

          <section>
            <h3>Structure availability</h3>
            <p>
              Molecular views use experimental coordinates when a compatible structure is available. The application does not infer a 3D structure when mapping is unavailable.
            </p>
          </section>

          <section className="bc-methodology-disclaimer">
            <h3>Research use only</h3>
            <p>
              Consequence labels are computational annotations, not clinical diagnoses or treatment advice. Experimental validation is required before drawing biological or clinical conclusions.
            </p>
          </section>
        </div>

        <footer className="bc-methodology-footer">
          <button
            type="button"
            onClick={onClose}
            className="bc-methodology-primary"
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
};
