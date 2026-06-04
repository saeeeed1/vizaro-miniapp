import { EmployeeDetailScreen } from "@/components/screens/employee-detail-screen";

interface EmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: EmployeePageProps) {
  const { id } = await params;
  return <EmployeeDetailScreen employeeId={id} />;
}
