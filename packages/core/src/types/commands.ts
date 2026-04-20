/**
 * Branded template identifier. Canton template IDs are of the form
 * `<package>:<module>:<entity>`, e.g. `#MyApp:Counter:Counter` (the `#`
 * prefix denotes the "primary" package when working with dapp-sdk).
 */
export type TemplateId = string & { readonly __brand: 'TemplateId' }

export function templateId(raw: string): TemplateId {
  return raw as TemplateId
}

export interface CreateCommand {
  CreateCommand: {
    templateId: TemplateId
    createArguments: Record<string, unknown>
  }
}

export interface ExerciseCommand {
  ExerciseCommand: {
    templateId: TemplateId
    contractId: string
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

export interface ExerciseByKeyCommand {
  ExerciseByKeyCommand: {
    templateId: TemplateId
    contractKey: Record<string, unknown>
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

export type Command = CreateCommand | ExerciseCommand | ExerciseByKeyCommand

export interface SubmitOptions {
  commands: Command[]
  actAs: string[]
  readAs?: string[]
  commandId?: string
  deduplicationDuration?: string // ISO-8601 duration, pass-through to ledger
}

export interface SubmitResult {
  updateId: string
  commandId: string
  completionOffset: string
}
