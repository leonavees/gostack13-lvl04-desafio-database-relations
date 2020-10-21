import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import IOrdersRepository from '../repositories/IOrdersRepository';

import Order from '../infra/typeorm/entities/Order';

interface IProduct {
    id: string;
    quantity: number;
}

interface IRequest {
    customer_id: string;
    products: IProduct[];
}

@injectable()
class CreateOrderService {
    constructor(
        @inject('OrdersRepository')
        private ordersRepository: IOrdersRepository,

        @inject('ProductsRepository')
        private productsRepository: IProductsRepository,

        @inject('CustomersRepository')
        private customersRepository: ICustomersRepository,
    ) {}

    public async execute({ customer_id, products }: IRequest): Promise<Order> {
        const customer = await this.customersRepository.findById(customer_id);

        if (!customer) {
            throw new AppError('Customer not found');
        }

        const productsByIds = await this.productsRepository.findAllById(
            products,
        );

        if (productsByIds.length !== products.length) {
            throw new AppError('No products found for order creation');
        }

        const productsWithInsufficientQuantities = products.filter(
            product =>
                (productsByIds.find(p => p.id === product.id) as Product)
                    .quantity < product.quantity,
        );

        if (productsWithInsufficientQuantities.length) {
            throw new AppError('Some products have insufficient stock');
        }

        const selectedProducts = productsByIds.map(({ id, price }) => ({
            product_id: id,
            quantity: products.find(p => p.id === id)?.quantity as number,
            price,
        }));

        const order = await this.ordersRepository.create({
            customer,
            products: selectedProducts,
        });

        await this.productsRepository.updateQuantity(
            selectedProducts.map(({ product_id, quantity }) => ({
                id: product_id,
                quantity:
                    (productsByIds.find(({ id }) => id === product_id)
                        ?.quantity as number) - quantity,
            })),
        );

        return order;
    }
}

export default CreateOrderService;
