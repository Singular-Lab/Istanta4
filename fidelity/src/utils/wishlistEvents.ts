/**
 * Sistema di eventi globali per la gestione della wishlist
 */

type WishlistEventType = 'item-added' | 'item-removed' | 'wishlist-updated' | 'wishlist-cleared';

interface WishlistEvent {
  type: WishlistEventType;
  data?: any;
  wishlistId?: string;
  timestamp: Date;
}

type WishlistEventListener = (event: WishlistEvent) => void;

class WishlistEventManager {
  private listeners: Map<WishlistEventType, Set<WishlistEventListener>> = new Map();

  /**
   * Registra un listener per un tipo di evento
   */
  on(eventType: WishlistEventType, listener: WishlistEventListener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Ritorna una funzione per rimuovere il listener
    return () => {
      this.off(eventType, listener);
    };
  }

  /**
   * Rimuove un listener
   */
  off(eventType: WishlistEventType, listener: WishlistEventListener) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emette un evento
   */
  emit(eventType: WishlistEventType, data?: any, wishlistId?: string) {
    const event: WishlistEvent = {
      type: eventType,
      data,
      wishlistId,
      timestamp: new Date()
    };

    console.log('📢 WishlistEvent emitted:', event);

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in wishlist event listener:', error);
        }
      });
    }
  }

  /**
   * Rimuove tutti i listeners
   */
  removeAllListeners() {
    this.listeners.clear();
  }
}

// Istanza singleton del manager eventi
export const wishlistEvents = new WishlistEventManager();

/**
 * Hook React per gestire eventi wishlist
 */
export const useWishlistEvents = () => {
  return {
    // Trigger events
    notifyItemAdded: (item: any, wishlistId?: string) => 
      wishlistEvents.emit('item-added', item, wishlistId),
    
    notifyItemRemoved: (itemId: string, wishlistId?: string) => 
      wishlistEvents.emit('item-removed', { itemId }, wishlistId),
    
    notifyWishlistUpdated: (wishlistId?: string) => 
      wishlistEvents.emit('wishlist-updated', null, wishlistId),
    
    notifyWishlistCleared: (wishlistId?: string) => 
      wishlistEvents.emit('wishlist-cleared', null, wishlistId),

    // Event manager per listener personalizzati
    events: wishlistEvents
  };
};

export default wishlistEvents; 