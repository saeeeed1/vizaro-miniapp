import { PrismaClient } from "@prisma/client";

import { createDemoData } from "@/lib/demo-data";
import { zonedDateAt } from "@/lib/utils";

const prisma = new PrismaClient();

async function main() {
  const seed = createDemoData();

  await prisma.auditLog.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.salaryConfig.deleteMany();

  await prisma.salaryConfig.create({
    data: {
      id: seed.salaryConfig.id,
      defaultMonthlySalaryUsd: seed.salaryConfig.defaultMonthlySalaryUsd,
      workStartTime: seed.salaryConfig.workStartTime,
      workEndTime: seed.salaryConfig.workEndTime,
      weeklyOffDay: seed.salaryConfig.weeklyOffDay,
      timezone: seed.salaryConfig.timezone,
      createdAt: new Date(seed.salaryConfig.createdAt),
      updatedAt: new Date(seed.salaryConfig.updatedAt)
    }
  });

  await prisma.user.createMany({
    data: seed.users.map((user) => ({
      id: user.id,
      telegramId: BigInt(user.telegramId),
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      createdAt: new Date(user.createdAt)
    }))
  });

  await prisma.employee.createMany({
    data: seed.employees.map((employee) => ({
      id: employee.id,
      userId: employee.userId,
      position: employee.position,
      monthlySalaryUsd: employee.monthlySalaryUsd,
      workStartTime: employee.workStartTime,
      workEndTime: employee.workEndTime,
      isActive: employee.isActive,
      createdAt: new Date(employee.createdAt),
      updatedAt: new Date(employee.updatedAt)
    }))
  });

  await prisma.holiday.createMany({
    data: seed.holidays.map((holiday) => ({
      id: holiday.id,
      date: new Date(holiday.date),
      title: holiday.title,
      isPaid: holiday.isPaid,
      createdAt: new Date(holiday.createdAt)
    }))
  });

  await prisma.attendanceRecord.createMany({
    data: seed.attendanceRecords.map((record) => ({
      id: record.id,
      employeeId: record.employeeId,
      date: zonedDateAt(record.date, "00:00", seed.salaryConfig.timezone),
      checkInTime: record.checkInTime ? new Date(record.checkInTime) : null,
      checkOutTime: record.checkOutTime ? new Date(record.checkOutTime) : null,
      status: record.status,
      lateMinutes: record.lateMinutes,
      earlyLeaveMinutes: record.earlyLeaveMinutes,
      workedMinutes: record.workedMinutes,
      expectedMinutes: record.expectedMinutes,
      dailyEarned: record.dailyEarned,
      dailyPenalty: record.dailyPenalty,
      netDailyAmount: record.netDailyAmount,
      notes: record.notes,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    }))
  });

  await prisma.penalty.createMany({
    data: seed.penalties.map((penalty) => ({
      id: penalty.id,
      employeeId: penalty.employeeId,
      attendanceRecordId: penalty.attendanceRecordId,
      type: penalty.type,
      minutes: penalty.minutes,
      amount: penalty.amount,
      reason: penalty.reason,
      createdAt: new Date(penalty.createdAt)
    }))
  });

  await prisma.auditLog.createMany({
    data: seed.auditLogs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId,
      employeeId: log.employeeId,
      attendanceRecordId: log.attendanceRecordId,
      action: log.action,
      payload: log.payload ?? undefined,
      createdAt: new Date(log.createdAt)
    }))
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
