// Loaded only by the explicitly enabled local development preview.
// Every request is intercepted; unsupported actions fail without reaching a server.
import roomImage from '../assets/marketing/room.jpg';
import houseImage from '../assets/marketing/starry-bowline.jpg';
import streamImage from '../assets/marketing/stream.jpg';
import { calendarDateKey } from './hostCalendar';
const date = offset => { const d = new Date(); d.setDate(d.getDate()+offset); return calendarDateKey(d); };
let listings = ['Penthouse','Cozy Room 1','Cozy Room 2','Cozy Mini','Open Loft','Waterfall & trails'].map((name,i) => ({ _id:`preview-room-${i}`, name, slug:['pent-house','cozy-1','cozy-2','cozy-mini','dormitory-open-loft','waterfall'][i], location:'Mudigere, Chikkamagaluru', images:[i === 5 ? streamImage : i === 4 ? houseImage : roomImage], price:i === 0 ? 2399 : 1999, priceUnit:'night', type:i === 5 ? 'trek':'room', active:true, maxOccupancy:4, capacity:4, availabilityStatus:'available', description:'A quiet stay in the heart of the Western Ghats.', shortDescription:'Wake up to misty hills and slow mornings.', amenities:['Wi-Fi','Breakfast','Parking'], facilities:[], availableDates:[], featured:i === 0 }));
let bookings = ['Anandhi','Pranav','Meera','Aditya','Rohan','Aisha'].map((name,i) => ({ _id:`preview-booking-${i}`, listing:listings[i%5], user:{_id:`user-${i}`,name,email:`guest${i}@example.com`}, contactName:name, contactEmail:`guest${i}@example.com`, contactPhone:'', bookingType:'room', startDate:date([-1,0,7,15,25,32][i]), endDate:date([1,2,9,17,28,35][i]), guests:2, adultGuests:2, childGuests:0, pets:0, status:'confirmed', paymentStatus:'paid', source:i%2 ? 'website':'airbnb', totalPrice:9596, amountPaid:9596, createdAt:new Date().toISOString() }));
let rules = [];
const stores = { '/admin/coupons':['coupons',[]], '/admin/employees':['employees',[]], '/admin/attendance':['attendance',[]], '/admin/checklists':['submissions',[]], '/admin/checklist-items':['items',[]], '/admin/faqs':['faqs',[]], '/admin/users':['users',[]] };
export function installAdminPreview(api) {
  api.defaults.adapter = async config => {
    const url = config.url; const method = config.method; const params = config.params || {};
    let body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {};
    const ok = data => ({ data:structuredClone(data),status:200,statusText:'OK',headers:{},config });
    if (method === 'get') {
      if (url === '/listings/admin/all') return ok({listings});
      if (url.startsWith('/bookings/admin/')) return ok({bookings:bookings.filter(b => (!params.status || b.status === params.status) && (!params.type || b.bookingType === params.type) && (!params.source || b.source === params.source))});
      if (url === '/admin/pricing-rules') return ok({rules});
      if (url === '/admin/overview') return ok({overview:{totalBookings:bookings.length,revenue:57576,activeListings:listings.length,activeUsers:6,breakdown:{room:6},upcomingBookings:bookings.filter(b => b.startDate > date(0))},notifications:[]});
      if (url === '/admin/analytics/monthly') return ok({revenue:57576,confirmedBookings:6,cancelledBookings:0,bySource:{airbnb:{count:3,revenue:28788},website:{count:3,revenue:28788}}});
      if (url === '/admin/whatsapp-contacts') return ok({totalContacts:12});
      if (url === '/sync/airbnb/full-house-url') return ok({icalUrl:''});
      if (url === '/sync/status') return ok({configured:false,lastSync:null});
      if (url === '/admin/reports/daily') return ok({report:{totals:{adults:4,children:0,pets:0},entries:[],dateLabel:params.date}});
      if (url === '/admin/laundry') return ok({stock:[{id:'towels',name:'Bath towels',stock:24},{id:'sheets',name:'Bed sheets',stock:18}],staff:[],adjustments:[],revision:1});
      if (stores[url]) return ok({[stores[url][0]]:stores[url][1]});
    }
    if (url === '/bookings/admin/block' && method === 'post') {
      for (const id of body.listingIds) {
        if (bookings.some(b => b.listing._id === id && ['confirmed','blocked'].includes(b.status) && b.startDate < body.endDate && b.endDate > body.startDate)) throw new Error('Dates overlap an existing stay');
        bookings.push({_id:`block-${Date.now()}`,listing:listings.find(r => r._id === id),...body,status:'blocked',bookingType:'room'});
      }
      return ok({message:'Dates blocked'});
    }
    if (url.startsWith('/bookings/admin/block/') && method === 'delete') { bookings = bookings.filter(b => b._id !== url.split('/').pop()); return ok({message:'Block removed'}); }
    if (url === '/admin/pricing-rules' && method === 'post') { rules.push({...body,_id:`rule-${Date.now()}`,createdAt:new Date().toISOString()}); return ok({rules}); }
    if (url.startsWith('/admin/pricing-rules/') && method === 'delete') { rules=rules.filter(r => r._id !== url.split('/').pop()); return ok({}); }
    if (url.startsWith('/listings') && ['put','post'].includes(method)) {
      const values = Object.fromEntries(body.entries()); values.images=JSON.parse(values.existingImages || '[]'); values.active=values.active === 'true'; values.featured=values.featured === 'true'; values.amenities=values.amenities?.split(',') || []; values.facilities=values.facilities?.split(',') || []; values.availableDates=values.availableDates?.split(',').filter(Boolean) || [];
      const id = method === 'put' ? url.split('/').pop() : `room-${Date.now()}`; const listing={...values,_id:id}; listings=method === 'put' ? listings.map(r => r._id === id ? listing : r) : [...listings,listing]; return ok({listing});
    }
    if (url.startsWith('/listings/') && method === 'delete') { listings=listings.map(r => r._id === url.split('/').pop() ? {...r,active:false} : r); return ok({}); }
    if (url.startsWith('/bookings/admin/') && method === 'patch') { const id=url.split('/')[3]; bookings=bookings.map(b => b._id === id ? {...b,...body} : b); return ok({}); }
    const error = new Error('This action is unavailable in the sample preview. No live request was sent.');
    error.response={data:{message:error.message},status:400}; throw error;
  };
}
