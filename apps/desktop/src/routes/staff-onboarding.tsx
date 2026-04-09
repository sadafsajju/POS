import { createFileRoute } from '@tanstack/react-router'
import { StaffOnboarding } from '@/components/setup/StaffOnboarding'

export const Route = createFileRoute('/staff-onboarding')({
  component: StaffOnboardingPage,
})

function StaffOnboardingPage() {
  return <StaffOnboarding />
}
