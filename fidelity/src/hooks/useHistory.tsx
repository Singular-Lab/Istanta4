import { useState, useCallback, useRef } from 'react';

type HistoryState<T> = {
    past: T[];
    present: T;
    future: T[];
};

export const useHistory = <T,>(initialPresent: T) => {
    const [state, setState] = useState<HistoryState<T>>({
        past: [],
        present: initialPresent,
        future: [],
    });

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const undo = useCallback(() => {
        if (!canUndo) return;

        setState((currentState) => {
            const { past, present, future } = currentState;
            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);
            return {
                past: newPast,
                present: previous,
                future: [present, ...future],
            };
        });
    }, [canUndo]);

    const redo = useCallback(() => {
        if (!canRedo) return;

        setState((currentState) => {
            const { past, present, future } = currentState;
            const next = future[0];
            const newFuture = future.slice(1);
            return {
                past: [...past, present],
                present: next,
                future: newFuture,
            };
        });
    }, [canRedo]);

    const set = useCallback((newPresent: T | ((currentState: T) => T)) => {
        setState((currentState) => {
            const { present } = currentState;
            const newPresentValue =
                typeof newPresent === 'function'
                    ? (newPresent as (currentState: T) => T)(present)
                    : newPresent;

            if (newPresentValue === present) {
                return currentState;
            }

            return {
                past: [...currentState.past, present],
                present: newPresentValue,
                future: [],
            };
        });
    }, []);

    const reset = useCallback((newPresent: T) => {
        setState({
            past: [],
            present: newPresent,
            future: [],
        });
    }, []);


    return { state: state.present, set, undo, redo, reset, canUndo, canRedo };
}; 