import { relations } from "drizzle-orm";
import {
  users,
  businessOwners,
  services,
  clients,
  appointments,
  reviews,
  discounts,
  giftCards,
  customSchedule,
} from "./schema";

export const usersRelations = relations(users, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [users.id],
    references: [businessOwners.userId],
  }),
}));

export const businessOwnersRelations = relations(businessOwners, ({ one, many }) => ({
  user: one(users, {
    fields: [businessOwners.userId],
    references: [users.id],
  }),
  services: many(services),
  clients: many(clients),
  appointments: many(appointments),
  reviews: many(reviews),
  discounts: many(discounts),
  giftCards: many(giftCards),
  customSchedule: many(customSchedule),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [services.businessOwnerId],
    references: [businessOwners.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [clients.businessOwnerId],
    references: [businessOwners.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [appointments.businessOwnerId],
    references: [businessOwners.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [reviews.businessOwnerId],
    references: [businessOwners.id],
  }),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [discounts.businessOwnerId],
    references: [businessOwners.id],
  }),
}));

export const giftCardsRelations = relations(giftCards, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [giftCards.businessOwnerId],
    references: [businessOwners.id],
  }),
}));

export const customScheduleRelations = relations(customSchedule, ({ one }) => ({
  businessOwner: one(businessOwners, {
    fields: [customSchedule.businessOwnerId],
    references: [businessOwners.id],
  }),
}));
