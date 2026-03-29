export interface Vehicle {
  id: string;
  name: string;
  type: string;
  ownerUid: string;
}

export interface Farmer {
  id: string;
  name: string;
  village: string;
  places?: string; // Comma separated list of lands
  phone?: string;
  ownerUid: string;
}

export interface WorkType {
  id: string;
  name: string;
  rate: number;
  ratePerHour?: number; // legacy
  unit: string;
  ownerUid: string;
}

export interface WorkLog {
  id: string;
  farmerId: string;
  vehicleId: string;
  workTypeId: string;
  durationHours?: number; // legacy or 'hour'
  quantity?: number;
  unit?: string; // e.g. 'packet', 'trip', 'acre'
  totalAmount: number;
  status: 'pending' | 'paid';
  place?: string;
  notes?: string;
  date: string;
  timestamp: number;
  ownerUid: string;
}
