import { createContext, useContext, useMemo, useState } from 'react';

const BookingCartContext = createContext(null);

export function BookingCartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = (listing, startDate, endDate, guests) => {
    setItems((prev) => [
      ...prev,
      {
        id: `${listing._id}-${Date.now()}`,
        listing,
        startDate,
        endDate,
        guests,
      },
    ]);
    setIsOpen(true);
  };

  const removeItem = (id) => setItems((prev) => prev.filter((item) => item.id !== id));

  const updateItem = (id, updates) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const clearCart = () => setItems([]);

  const value = useMemo(
    () => ({ items, isOpen, setIsOpen, addItem, removeItem, updateItem, clearCart }),
    [items, isOpen]
  );

  return <BookingCartContext.Provider value={value}>{children}</BookingCartContext.Provider>;
}

export const useBookingCart = () => {
  const ctx = useContext(BookingCartContext);
  if (!ctx) throw new Error('useBookingCart must be used inside BookingCartProvider');
  return ctx;
};
