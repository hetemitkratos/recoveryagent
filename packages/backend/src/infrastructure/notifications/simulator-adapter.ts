import type { NotificationProvider, SendMessageParams } from './notification-provider.js';
import { nanoid } from 'nanoid';

export class SimulatorNotificationAdapter implements NotificationProvider {
  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; provider_reference: string }> {
    console.log(`[SIMULATOR NOTIFICATION] To: ${params.customer.phone}/${params.customer.email}`);
    console.log(`[SIMULATOR NOTIFICATION] Message: ${params.message}`);
    
    return {
      success: true,
      provider_reference: `msg_sim_${nanoid()}`
    };
  }
}
