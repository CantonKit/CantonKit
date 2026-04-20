import type { TemplateId } from './commands.js'

export interface QueryACSOptions {
  templateId: TemplateId
  parties: string[]
  filter?: { key?: Record<string, unknown> }
}

export interface ActiveContract<T = unknown> {
  contractId: string
  templateId: TemplateId
  payload: T
  signatories: string[]
  observers: string[]
}
