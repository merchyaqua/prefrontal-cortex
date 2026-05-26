import Anthropic from '@anthropic-ai/sdk'
import type { IpcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import type { Principle, DestructorResult, DestructorRequest } from '../../shared/types'

function getClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env')
  return new Anthropic({ apiKey })
}

// ─── restructure principle ─────────────────────────────────────────────────────

const II_TOOL: Anthropic.Tool = {
  name: 'extract_implementation_intention',
  description: 'Extract an implementation intention from a principle statement.',
  input_schema: {
    type: 'object',
    properties: {
      ii_when: {
        type: 'string',
        description: 'Trigger/situation: "When I notice X..." — one sentence, first person.'
      },
      ii_then: {
        type: 'string',
        description: 'Intended response: "...I will Y" — one sentence, first person.'
      },
      ii_because: {
        type: 'string',
        description: 'Underlying motivation: "...because Z" — one sentence, first person.'
      }
    },
    required: ['ii_when', 'ii_then', 'ii_because']
  }
}

async function restructurePrinciple(
  text: string
): Promise<{ ii_when: string; ii_then: string; ii_because: string }> {
  const msg = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system:
      'Extract an implementation intention from the user\'s principle. ' +
      'Be concise — one sentence per field. Use first person. ' +
      'ii_when is the trigger, ii_then is the action, ii_because is the motivation.',
    tools: [II_TOOL],
    tool_choice: { type: 'tool', name: 'extract_implementation_intention' },
    messages: [{ role: 'user', content: text }]
  })

  const block = msg.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('No tool_use block returned')
  const input = block.input as { ii_when: string; ii_then: string; ii_because: string }
  return input
}

// ─── thought destructor ────────────────────────────────────────────────────────

const DESTRUCTOR_SYSTEM =
  'You are a CBT/ACT-flavoured thought analyser. Given a list of the user\'s principles (each with an id) and a self-defeating thought, ' +
  'return: highlightedSpans (character-level spans in the original thought that are self-defeating, with a short reason), ' +
  'principleId (the id of the single most relevant principle — omit if none apply), ' +
  'principleKeyPhrases (up to 3 exact verbatim phrases copied from that principle\'s text that are most relevant — must be exact substrings), ' +
  'a concrete suggestedAction (Snowballing style — smallest viable next step, one sentence), ' +
  'and a framing (short pattern-name only, e.g. "abstinence violation effect"). ' +
  'Be terse. No prose paragraphs. No preamble.'

const DESTRUCTOR_TOOL: Anthropic.Tool = {
  name: 'analyze_thought',
  description: 'Analyse a self-defeating thought and identify the most relevant user principle.',
  input_schema: {
    type: 'object',
    properties: {
      highlightedSpans: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            start: { type: 'number' },
            end: { type: 'number' },
            reason: { type: 'string' }
          },
          required: ['start', 'end', 'reason']
        }
      },
      principleId: {
        type: 'string',
        description: 'The id of the most relevant principle. Omit if none applies.'
      },
      principleKeyPhrases: {
        type: 'array',
        description: 'Up to 3 exact verbatim phrases copied from the matched principle text that are most relevant to this thought. Must be exact substrings. Omit if no principle matched.',
        items: { type: 'string' }
      },
      suggestedAction: { type: 'string' },
      framing: { type: 'string' }
    },
    required: ['highlightedSpans', 'suggestedAction', 'framing']
  }
}

async function rewrite(
  thought: string,
  principles: Principle[],
  currentIntent?: string
): Promise<DestructorResult> {
  const activePrinciples = principles.filter((p) => p.active)
  const principlesText =
    activePrinciples.length > 0
      ? activePrinciples.map((p) => `[${p.id}] ${p.text}`).join('\n')
      : '(none)'

  const msg = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    // cache_control is valid at runtime but not typed in sdk 0.32; cast via unknown
    system: [
      { type: 'text', text: DESTRUCTOR_SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `PRINCIPLES:\n${principlesText}`, cache_control: { type: 'ephemeral' } }
    ] as unknown as Anthropic.TextBlockParam[],
    tools: [DESTRUCTOR_TOOL],
    tool_choice: { type: 'tool', name: 'analyze_thought' },
    messages: [
      {
        role: 'user',
        content: `CURRENT_INTENT: ${currentIntent ?? 'none'}\nTHOUGHT: ${thought}`
      }
    ]
  })

  const block = msg.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('No tool_use block returned')
  const input = block.input as Omit<DestructorResult, 'principleId' | 'principleKeyPhrases'> & { principleId?: string; principleKeyPhrases?: string[] }
  return { ...input, principleId: input.principleId ?? null, principleKeyPhrases: input.principleKeyPhrases ?? [] }
}

// ─── IPC handler registration ─────────────────────────────────────────────────

export function registerClaudeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.claude.restructurePrinciple, async (_e, text: string) => {
    return restructurePrinciple(text)
  })

  ipcMain.handle(
    IPC.claude.rewrite,
    async (_e, req: DestructorRequest & { principles: Principle[] }) => {
      return rewrite(req.thought, req.principles, req.currentIntent)
    }
  )
}
