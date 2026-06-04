import { AppError } from "@/lib/errors";
import type { OrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent, isEventEditable } from "@/services/organizer/events.service";
import type { OrganizerTicketType } from "@/types/organizer";

export async function listOrganizerTicketTypes(
  ctx: OrganizerContext,
  eventId: string,
): Promise<OrganizerTicketType[]> {
  await getOrganizerEvent(ctx, eventId);

  const { data, error } = await ctx.supabase
    .from("ticket_types")
    .select("id, event_id, name, description, price, total_capacity, available, is_active")
    .eq("event_id", eventId)
    .order("price", { ascending: true });

  if (error) {
    throw new AppError("Failed to load ticket types", { code: "DATABASE", cause: error });
  }

  return (data ?? []).map(mapTicketType);
}

export async function createOrganizerTicketType(
  ctx: OrganizerContext,
  eventId: string,
  input: {
    name: string;
    description?: string | null;
    price: number;
    totalCapacity: number;
  },
): Promise<OrganizerTicketType> {
  const event = await getOrganizerEvent(ctx, eventId);
  if (!isEventEditable(event.status)) {
    throw new AppError("Ticket types cannot be added after the event is approved", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data, error } = await ctx.supabase
    .from("ticket_types")
    .insert({
      event_id: eventId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      total_capacity: input.totalCapacity,
      available: input.totalCapacity,
      is_active: true,
    })
    .select("id, event_id, name, description, price, total_capacity, available, is_active")
    .single();

  if (error || !data) {
    throw new AppError("Failed to create ticket type", { code: "DATABASE", cause: error });
  }

  return mapTicketType(data);
}

export async function updateOrganizerTicketType(
  ctx: OrganizerContext,
  eventId: string,
  ticketTypeId: string,
  input: Partial<{
    name: string;
    description: string | null;
    price: number;
    totalCapacity: number;
    isActive: boolean;
  }>,
): Promise<OrganizerTicketType> {
  const event = await getOrganizerEvent(ctx, eventId);
  if (!isEventEditable(event.status)) {
    throw new AppError("Ticket types cannot be edited after the event is approved", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data: existing, error: loadError } = await ctx.supabase
    .from("ticket_types")
    .select("id, total_capacity, available")
    .eq("id", ticketTypeId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (loadError || !existing) {
    throw new AppError("Ticket type not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (input.totalCapacity !== undefined && input.totalCapacity < existing.total_capacity - existing.available) {
    throw new AppError("Capacity cannot be less than tickets already sold or held", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }

  const sold = existing.total_capacity - existing.available;
  const { data, error } = await ctx.supabase
    .from("ticket_types")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.totalCapacity !== undefined
        ? {
            total_capacity: input.totalCapacity,
            available: input.totalCapacity - sold,
          }
        : {}),
    })
    .eq("id", ticketTypeId)
    .eq("event_id", eventId)
    .select("id, event_id, name, description, price, total_capacity, available, is_active")
    .single();

  if (error || !data) {
    throw new AppError("Failed to update ticket type", { code: "DATABASE", cause: error });
  }

  return mapTicketType(data);
}

export async function deleteOrganizerTicketType(
  ctx: OrganizerContext,
  eventId: string,
  ticketTypeId: string,
): Promise<void> {
  const event = await getOrganizerEvent(ctx, eventId);
  if (!isEventEditable(event.status)) {
    throw new AppError("Ticket types cannot be removed after the event is approved", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data: existing } = await ctx.supabase
    .from("ticket_types")
    .select("total_capacity, available")
    .eq("id", ticketTypeId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!existing) {
    throw new AppError("Ticket type not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (existing.available !== existing.total_capacity) {
    throw new AppError("Cannot delete a ticket type with sales or holds", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { error } = await ctx.supabase
    .from("ticket_types")
    .delete()
    .eq("id", ticketTypeId)
    .eq("event_id", eventId);

  if (error) {
    throw new AppError("Failed to delete ticket type", { code: "DATABASE", cause: error });
  }
}

function mapTicketType(row: {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  total_capacity: number;
  available: number;
  is_active: boolean;
}): OrganizerTicketType {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    totalCapacity: row.total_capacity,
    available: row.available,
    isActive: row.is_active,
  };
}
