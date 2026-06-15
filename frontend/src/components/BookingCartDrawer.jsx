import { ShoppingBagIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useBookingCart } from '../context/BookingCartContext';
import { formatCurrency, formatDate } from '../lib/formatters';

function BookingCartDrawer() {
  const { items, isOpen, setIsOpen, removeItem } = useBookingCart();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const nightsBetween = (start, end) =>
    Math.max(Math.round((new Date(end) - new Date(start)) / 86400000), 1);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-[#0d1710] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5 text-lime-300" />
            <h2 className="text-lg font-semibold text-white">
              Booking Cart
              {items.length > 0 && (
                <span className="ml-2 rounded-full bg-lime-300 px-2 py-0.5 text-xs font-bold text-slate-900">
                  {items.length}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-1 text-slate-400 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <ShoppingBagIcon className="h-12 w-12 opacity-30" />
              <p>Your cart is empty</p>
              <p className="text-sm">Add rooms to book multiple stays at once</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => {
                const nights = nightsBetween(item.startDate, item.endDate);
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex gap-3">
                      <img
                        src={item.listing.images?.[0] || 'https://placehold.co/80x80'}
                        alt={item.listing.name}
                        className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">{item.listing.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatDate(item.startDate)} → {formatDate(item.endDate)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {nights} night{nights > 1 ? 's' : ''} · {item.guests} guest{item.guests > 1 ? 's' : ''}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-lime-300">
                          {formatCurrency(item.listing.price * nights)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="self-start rounded-full p-1 text-slate-500 hover:text-rose-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-white/10 px-6 py-4">
            <button
              className="btn-primary w-full"
              onClick={() => {
                setIsOpen(false);
                navigate('/checkout');
              }}
            >
              Proceed to Checkout ({items.length} room{items.length > 1 ? 's' : ''})
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default BookingCartDrawer;
