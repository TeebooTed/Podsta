import { assertTurtleIri } from './urls.js';

/** Public read for one resource, plus full control for the owner. No default/inherit. */
export function publicReadTurtle(resourceUrl, ownerWebId) {
  const resource = assertTurtleIri(resourceUrl);
  const owner = assertTurtleIri(ownerWebId);
  return `
@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<#owner>
  a acl:Authorization ;
  acl:accessTo <${resource}> ;
  acl:agent <${owner}> ;
  acl:mode acl:Read, acl:Write, acl:Control .

<#public>
  a acl:Authorization ;
  acl:accessTo <${resource}> ;
  acl:agentClass foaf:Agent ;
  acl:mode acl:Read .
`.trim();
}

/**
 * Read for members of a vcard group, plus full control for the owner.
 * No public agent, no Append, and no default/inherit.
 * The group document itself must be readable by the person asking, or the
 * server cannot check membership.
 */
export function groupReadTurtle(resourceUrl, ownerWebId, groupUrl) {
  const resource = assertTurtleIri(resourceUrl);
  const owner = assertTurtleIri(ownerWebId);
  const group = assertTurtleIri(groupUrl);
  return `
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
  a acl:Authorization ;
  acl:accessTo <${resource}> ;
  acl:agent <${owner}> ;
  acl:mode acl:Read, acl:Write, acl:Control .

<#contacts>
  a acl:Authorization ;
  acl:accessTo <${resource}> ;
  acl:agentGroup <${group}> ;
  acl:mode acl:Read .
`.trim();
}

/**
 * Owner-only ACL. `inherit` adds acl:default so children of a container
 * (comment files) do not keep an older public rule.
 */
export function ownerOnlyTurtle(resourceUrl, ownerWebId, { inherit = false } = {}) {
  const resource = assertTurtleIri(resourceUrl);
  const owner = assertTurtleIri(ownerWebId);
  const fallback = inherit ? `\n  acl:default <${resource}> ;` : '';
  return `
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
  a acl:Authorization ;
  acl:accessTo <${resource}> ;${fallback}
  acl:agent <${owner}> ;
  acl:mode acl:Read, acl:Write, acl:Control .
`.trim();
}

/** True when a Turtle ACL grants read to the public agent class. */
export function aclGrantsPublicRead(turtle) {
  if (!turtle || typeof turtle !== 'string') return false;
  return /foaf:Agent/.test(turtle) && /acl:Read/.test(turtle);
}

/**
 * Share and unshare must not report success when any sibling write failed.
 * A photo can otherwise be public while its caption stays private.
 */
export function assertAllSucceeded(results, action) {
  const failed = results.filter((result) => result.status === 'rejected');
  if (!failed.length) return;
  const first = failed[0].reason?.message || 'unknown';
  if (failed.length === results.length) {
    throw new Error(`Failed to ${action}: ${first}`);
  }
  const label = action.charAt(0).toUpperCase() + action.slice(1);
  throw new Error(`${label} incomplete (${failed.length} of ${results.length} failed): ${first}`);
}
