export type UserRole = 'doctor' | 'patient';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  specialization?: string;
  bio?: string;
  createdAt: string;
}

export type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  status: AppointmentStatus;
  date: string;
  time: string;
  reason: string;
  prescription?: string;
  createdAt: string;
  patientName?: string;
  doctorName?: string;
}

export interface MedicalReport {
  id: string;
  title: string;
  content: string;
  patientId: string;
  createdAt: string;
  issuedBy?: string;
  fileName?: string;
}

export interface Message {
  id: string;
  appointmentId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface Emergency {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  status: 'active' | 'resolved';
  location?: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  medication: string;
  dosage: string;
  instructions: string;
  isPaid: boolean;
  amount: number;
  createdAt: string;
  patientResponse?: string;
}

export interface Vital {
  id: string;
  patientId: string;
  type: 'Blood Pressure' | 'Glucose' | 'Heart Rate' | 'Weight' | 'Temperature' | 'Resp. Rate';
  value: number;
  unit: string;
  createdAt: string;
}

export interface CareTask {
  id: string;
  userId: string;
  title: string;
  type: 'medication' | 'followup' | 'clinical';
  isCompleted: boolean;
  dueDate: string;
}
