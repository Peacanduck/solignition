import type { LoanAccount } from '../data-access/use-loans'
import type { ProjectSummary } from '../data-access/use-projects'

export interface GroupedProject {
  summary: ProjectSummary
  /** The project's loans, ordered by their program index (missing ones skipped). */
  loans: LoanAccount[]
}

export interface GroupedLoans {
  projects: GroupedProject[]
  /** Loans not referenced by any project — rendered exactly as before. */
  standalone: LoanAccount[]
}

/**
 * Join on-chain loans with their off-chain project grouping. Every loan that
 * isn't referenced by a `ProjectRecord` falls through to `standalone`, so
 * pre-feature loans (and all single-program borrows) render unchanged.
 *
 * Pure — no hooks, no I/O — so it's trivially unit-testable. In Phase 2 the
 * only change is swapping the join source from `project.programs[].loanId` to
 * an on-chain `loan.data.projectId`.
 */
export function groupLoans(loans: LoanAccount[], projects: ProjectSummary[]): GroupedLoans {
  // loanId (string) → projectId
  const loanToProject = new Map<string, string>()
  for (const summary of projects) {
    for (const program of summary.project.programs) {
      loanToProject.set(program.loanId, summary.project.projectId)
    }
  }

  // loanId (string) → loan, for fast ordered lookup per project.
  const loanById = new Map<string, LoanAccount>()
  for (const loan of loans) {
    loanById.set(loan.data.loanId.toString(), loan)
  }

  const groupedProjects: GroupedProject[] = projects
    .map((summary) => ({
      summary,
      loans: summary.project.programs
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((program) => loanById.get(program.loanId))
        .filter((loan): loan is LoanAccount => loan !== undefined),
    }))
    // A project with none of its loans visible on-chain yet isn't worth a card.
    .filter((group) => group.loans.length > 0)

  const standalone = loans.filter((loan) => !loanToProject.has(loan.data.loanId.toString()))

  return { projects: groupedProjects, standalone }
}
