import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query'
import type { CantonError, SubmitOptions, SubmitResult } from '@cantonkit/core'
import { useCantonClient } from '../context.js'

export interface UseSubmitOptions
  extends Omit<
    UseMutationOptions<SubmitResult, CantonError, SubmitOptions>,
    'mutationFn'
  > {
  /** When false, skips the default invalidation of ['canton', 'acs']. Default true. */
  invalidate?: boolean
}

export function useSubmit(
  options: UseSubmitOptions = {}
): UseMutationResult<SubmitResult, CantonError, SubmitOptions> {
  const client = useCantonClient()
  const queryClient = useQueryClient()
  const { invalidate = true, onSuccess: userOnSuccess, ...rest } = options

  return useMutation<SubmitResult, CantonError, SubmitOptions>({
    mutationFn: (opts: SubmitOptions) => client.submitAndWait(opts),
    onSuccess: (data, variables, onMutateResult, context) => {
      if (invalidate) {
        // Prefix match in TanStack v5 — invalidates every useContracts query.
        queryClient.invalidateQueries({ queryKey: ['canton', 'acs'] })
      }
      userOnSuccess?.(data, variables, onMutateResult, context)
    },
    ...rest,
  })
}
