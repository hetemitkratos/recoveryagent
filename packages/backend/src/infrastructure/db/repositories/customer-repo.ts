import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { customers } from '../schema.js';
import type { Customer } from '../../../domain/entities/customer.js';

export class CustomerRepository {
  async findById(id: string): Promise<Customer | null> {
    const results = await db.select().from(customers).where(eq(customers.id, id));
    return results[0] as Customer || null;
  }

  async findByExternalId(externalId: string): Promise<Customer | null> {
    const results = await db.select().from(customers).where(eq(customers.external_customer_id, externalId));
    return results[0] as Customer || null;
  }

  async create(customer: Omit<Customer, 'created_at' | 'updated_at'>): Promise<Customer> {
    const now = new Date();
    const result = await db.insert(customers).values({
      ...customer,
      created_at: now,
      updated_at: now,
    }).returning();
    return result[0] as Customer;
  }

  async update(id: string, data: Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at'>>): Promise<Customer> {
    const now = new Date();
    const result = await db.update(customers)
      .set({ ...data, updated_at: now })
      .where(eq(customers.id, id))
      .returning();
    return result[0] as Customer;
  }

  async setOptOut(id: string, optedOut: boolean): Promise<Customer> {
    return this.update(id, { opted_out: optedOut });
  }
}
