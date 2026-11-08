-- AF-039 repair: qualify outer consortium ID; unqualified "id" in the
-- correlated EXISTS resolves to membership.id, hiding invited members.
-- Additive migration preserves the historical checksum of 032.
DROP POLICY consortium_owners_and_invitees ON public.municipal_consortia;
CREATE POLICY consortium_owners_and_invitees ON public.municipal_consortia
 USING(
 owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 OR EXISTS(
 SELECT 1 FROM public.consortium_memberships m
 WHERE m.consortium_id=municipal_consortia.id
 AND m.member_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND m.state IN('invited','active')
 ))
 WITH CHECK(
 owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM public.users u
  WHERE u.id=created_by AND u.active AND u.role='admin')
 );
