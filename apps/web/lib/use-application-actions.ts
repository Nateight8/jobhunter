"use client";

import { useMutation } from "@apollo/client/react";
import {
  APPLICATION_COUNTS_QUERY,
  APPLICATIONS_QUERY,
  REMOVE_APPLICATION_MUTATION,
  SET_NOTES_MUTATION,
  SET_STATUS_MUTATION,
} from "./application-queries";
import type { ApplicationStatus } from "./gql/graphql";

/**
 * Save, hide, record progress. `evict` takes the job out of the feed lists right away, so the
 * list doesn't jump back to page one. `refetchList` is for the /applications page.
 */
export function useApplicationActions(refetchList = false) {
  const refetchQueries = refetchList
    ? [APPLICATION_COUNTS_QUERY, APPLICATIONS_QUERY]
    : [APPLICATION_COUNTS_QUERY];
  const [setStatusMutation] = useMutation(SET_STATUS_MUTATION, { refetchQueries });
  const [removeMutation] = useMutation(REMOVE_APPLICATION_MUTATION, { refetchQueries });
  const [notesMutation] = useMutation(SET_NOTES_MUTATION);

  return {
    setStatus: (jobId: string, status: ApplicationStatus, opts: { evict?: boolean } = {}) =>
      setStatusMutation({
        variables: { jobId, status },
        update(cache) {
          if (!opts.evict) return;
          cache.modify({
            fields: {
              // Runs for every cached variant of the jobs list (one per filter).
              // The parameters are untyped on purpose: Apollo's cache shapes are internal.
              jobs(existing, { readField }) {
                if (!existing?.edges) return existing;
                const edges = existing.edges.filter(
                  (e: { node: never }) => readField("id", e.node) !== jobId,
                );
                const removed = existing.edges.length - edges.length;
                if (!removed) return existing;
                return {
                  ...existing,
                  edges,
                  totalCount: Math.max(0, (existing.totalCount ?? 0) - removed),
                };
              },
            },
          });
        },
      }),
    remove: (jobId: string) => removeMutation({ variables: { jobId } }),
    setNotes: (jobId: string, notes: string) => notesMutation({ variables: { jobId, notes } }),
  };
}
