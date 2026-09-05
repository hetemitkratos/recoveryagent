export interface ExperimentAssignment {
  id: string;
  experiment_id: string;
  customer_id: string;
  payment_id?: string;
  variant: 'CONTROL' | 'TREATMENT';
  assigned_at: Date;
  is_demo: boolean;
}

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED';
  seed: number;
  control_count: number;
  treatment_count: number;
  started_at: Date;
  completed_at?: Date;
  control_recovered_revenue?: number;
  treatment_recovered_revenue?: number;
  incremental_revenue?: number;
  control_recovery_rate?: number;
  treatment_recovery_rate?: number;
  incremental_lift_pp?: number;
  roi?: number;
  is_demo: boolean;
}
