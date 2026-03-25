// @nextkid/shared — types, utilities, and constants shared between web and mobile

export * from './types';
export * from './constants';

// Shipping helpers and types — used in listing creation (parcel dims) and checkout (quotes)
export {
  canFitInLocker,
  getLockerSizeForParcel,
  dimensionsToTCGParcel,
  userLocationToTCGAddress,
  LOCKER_SIZES,
} from '../types/shipping';
export type {
  ParcelDimensions,
  SellerShippingOption,
  ShippingMethod,
  TCGParcel,
  TCGAddress,
  TCGLockerAddress,
  TCGRateOption,
  ShippingQuote,
  CheckoutShipping,
  OrderShipping,
  LockerSize,
} from '../types/shipping';

// Location types — used in shipping address conversion and profile forms
export type { UserLocation } from '../types/location';
