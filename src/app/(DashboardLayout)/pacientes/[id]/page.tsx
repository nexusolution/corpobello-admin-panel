import { PatientDetail } from './patient-detail'

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PatientDetail id={id} />
}
