import { WaiverForm } from './WaiverForm';
import { GroomingNote } from './GroomingNote';
import { WaitlistEntry } from './WaitlistEntry';
import { NoShowPolicy } from './NoShowPolicy';
import { Tip } from './Tip';
import { Commission } from './Commission';
import { Supplier } from './Supplier';
import { InventoryLot } from './InventoryLot';
import { Product } from './Product';
import { BarberChair } from './BarberChair';
import { User } from './User';
import { ShopSettings } from './ShopSettings';
import { Role } from './Role';
import { ServiceCategory } from './ServiceCategory';
import { Service } from './Service';
import { Barber } from './Barber';
import { BarberSchedule } from './BarberSchedule';
import { Customer } from './Customer';
import { CustomerNote } from './CustomerNote';
import { Appointment } from './Appointment';
import { GuestBookingCommand } from './GuestBookingCommand';
import { AppointmentLineItem } from './AppointmentLineItem';
import { WalkInQueueEntry } from './WalkInQueueEntry';
import { MembershipPlan } from './MembershipPlan';
import { ServicePackage } from './ServicePackage';
import { ServicePackageItem } from './ServicePackageItem';
import { CustomerPackage } from './CustomerPackage';
import { CheckoutTransaction } from './CheckoutTransaction';
import { PaymentProvider } from './PaymentProvider';
import { PaymentSession } from './PaymentSession';
import { PaymentWebhookEvent } from './PaymentWebhookEvent';
import { InventoryMovement } from './InventoryMovement';
import { PackageUsage } from './PackageUsage';
import { Shop } from './Shop';
import { ShopMembership } from './ShopMembership';
import { LifecycleOutboxEvent } from './LifecycleOutboxEvent';
import { NoShowEvent } from './NoShowEvent';
import { CommissionPayout } from './CommissionPayout';
import { ProductSaleLine } from './ProductSaleLine';
import { PaymentReconciliation } from './PaymentReconciliation';
import { ScheduleException } from './ScheduleException';
import { StaffShift } from './StaffShift';
import { MembershipEvent } from './MembershipEvent';
import { PractitionerCredential } from './PractitionerCredential';
import { BookingPolicy } from './BookingPolicy';
import { AppointmentChangeEvent } from './AppointmentChangeEvent';
import { CashRefund } from './CashRefund';

import { enforceRelationshipBoundaries } from '../utils/relationshipBoundaries';

export const models = enforceRelationshipBoundaries({
  User,
  Role,
  Shop,
  ShopMembership,
  LifecycleOutboxEvent,
  NoShowEvent,
  CommissionPayout,
  ProductSaleLine,
  PaymentReconciliation,
  ShopSettings,
  ServiceCategory,
  Service,
  Barber,
  BarberSchedule,
  ScheduleException,
  StaffShift,
  PractitionerCredential,
  BookingPolicy,
  AppointmentChangeEvent,
  Customer,
  CustomerNote,
  Appointment,
  GuestBookingCommand,
  AppointmentLineItem,
  WalkInQueueEntry,
  MembershipPlan,
  ServicePackage,
  ServicePackageItem,
  CustomerPackage,
  MembershipEvent,
  CheckoutTransaction,
  CashRefund,
  PaymentProvider,
  PaymentSession,
  PaymentWebhookEvent,
  InventoryMovement,
  PackageUsage,
  WaiverForm,
  GroomingNote,
  WaitlistEntry,
  NoShowPolicy,
  Tip,
  Commission,
  Supplier,
  InventoryLot,
  Product,
  BarberChair,
});

export default models;
