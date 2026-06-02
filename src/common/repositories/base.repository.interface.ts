export interface IBaseRepository<T> {
  findAll(options?: any): Promise<T[]>;
  findById(id: number): Promise<T | null>;
  create(data: any): Promise<T>;
  update(id: number, data: any): Promise<T>;
  delete(id: number): Promise<T>;
}
