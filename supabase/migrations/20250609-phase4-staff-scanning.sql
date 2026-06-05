-- Phase 4: Staff scanning — read assigned events + ticket types (JWT / RLS, no service role)

CREATE POLICY events_staff_assigned_read ON events
  FOR SELECT
  USING (
    current_user_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM staff_event_assignments sea
      WHERE sea.staff_id = current_user_id()
        AND sea.event_id = events.id
    )
  );

CREATE POLICY ticket_types_staff_assigned_read ON ticket_types
  FOR SELECT
  USING (
    current_user_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM staff_event_assignments sea
      WHERE sea.staff_id = current_user_id()
        AND sea.event_id = ticket_types.event_id
    )
  );
