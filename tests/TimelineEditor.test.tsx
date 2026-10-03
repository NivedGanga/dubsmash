/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ClipCharacter, TimelineSection } from '@/types/database';
import { TimelineEditor } from '@/components/Timeline/TimelineEditor';
import { createTimeline, validateTimeline } from '@/lib/timeline';

const chars: ClipCharacter[] = [
  { id: 'A', name: 'Alice', color: '#ef4444' },
  { id: 'B', name: 'Bob', color: '#3b82f6' },
  { id: 'C', name: 'Cara', color: '#22c55e' },
];

let latest: TimelineSection[] = [];

function Harness({ duration = 20 }: { duration?: number }) {
  const [sections, setSections] = useState(() => createTimeline(duration));
  latest = sections;
  return <TimelineEditor duration={duration} sections={sections} characters={chars} onChange={setSections} currentTime={0} onSeek={() => {}} />;
}

beforeAll(() => {
  // jsdom 20 has no PointerEvent; without it clientX would be dropped from synthetic events.
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
  }
  // jsdom has no layout or pointer capture: give the track a 1000px width at x=0.
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: 0, width: 1000, top: 0, height: 80, right: 1000, bottom: 80, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

function drag(el: Element, toX: number) {
  // Separate act() calls so React re-renders between events, as a browser would.
  act(() => void fireEvent.pointerDown(el, { pointerId: 1, clientX: 0 }));
  act(() => void fireEvent.pointerMove(el, { pointerId: 1, clientX: toX }));
  act(() => void fireEvent.pointerUp(el, { pointerId: 1, clientX: toX }));
}

describe('TimelineEditor (DOM)', () => {
  it('maps the spec example by dragging pointers and assigning characters', () => {
    render(<Harness />);
    // Drag the end pointer from 20s to 7s (350px of 1000px).
    drag(screen.getByLabelText(/^End pointer/), 350);
    expect(latest.map((s) => [s.start, s.end])).toEqual([[0, 7], [7, 20]]);

    // Assign first section to Alice via the section button + character button.
    fireEvent.click(screen.getByLabelText(/^Section 1,/));
    fireEvent.click(screen.getByRole('button', { name: /1\. Alice/ }));

    drag(screen.getByLabelText(/^End pointer/), 650);
    expect(latest.map((s) => [s.start, s.end])).toEqual([[0, 7], [7, 13], [13, 20]]);

    fireEvent.click(screen.getByLabelText(/^Section 2,/));
    fireEvent.click(screen.getByRole('button', { name: /2\. Bob/ }));
    fireEvent.click(screen.getByLabelText(/^Section 3,/));
    fireEvent.click(screen.getByRole('button', { name: /3\. Cara/ }));

    expect(latest.map((s) => s.character_id)).toEqual(['A', 'B', 'C']);
    expect(validateTimeline(latest, 20, chars).valid).toBe(true);
    expect(screen.getByText(/All sections mapped/)).toBeTruthy();
  });

  it('moves an inner pointer without crossing and removes it on double-click', () => {
    render(<Harness />);
    drag(screen.getByLabelText(/^End pointer/), 500);
    drag(screen.getByLabelText(/^Boundary 1 at/), 990);
    expect(latest[0]!.end).toBe(19.5);
    act(() => {
      fireEvent.doubleClick(screen.getByLabelText(/^Boundary 1 at/));
    });
    expect(latest).toHaveLength(1);
  });

  it('assigns with number keys and merges same-character neighbours', () => {
    const { container } = render(<Harness />);
    drag(screen.getByLabelText(/^End pointer/), 500);
    fireEvent.click(screen.getByLabelText(/^Section 1,/));
    fireEvent.keyDown(container.firstChild as Element, { key: '1' });
    fireEvent.click(screen.getByLabelText(/^Section 2,/));
    fireEvent.keyDown(container.firstChild as Element, { key: '1' });
    expect(latest).toHaveLength(1);
    expect(latest[0]!.character_id).toBe('A');
  });
});
