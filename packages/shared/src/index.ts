// @nextkid/shared — types, utilities, and constants shared between web and mobile

export * from './types';
export * from './constants';

// Shipping helpers — used in listing creation (parcel dims) and checkout (quotes)
export { canFitInLocker, getLockerSizeForParcel, LOCKER_SIZES } from '../types/shipping';
export type { ParcelDimensions, SellerShippingOption, ShippingMethod, TCGParcel } from '../types/shipping';
