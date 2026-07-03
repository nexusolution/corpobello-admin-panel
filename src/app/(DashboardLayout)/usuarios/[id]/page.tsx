import { UserDetail } from './user-detail'

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <UserDetail id={id} />
}