import { Inject, Injectable } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ClientKafka } from '@nestjs/microservices';
import { DataResponse } from '../../common/swagger/data-response.dto';
import { Envs } from '../../common/envs/env';
import { InjectEnum } from './types/inject.enum';
import { EventsEnum } from './types/events.enum';
import { MessageDto } from './dto/message.dto';

@Injectable()
export class QueueService {
    private readonly producer: Producer;
    private isConnected: boolean = false;

    constructor(@Inject(InjectEnum.NOTIFICATIONS_MICROSERVICE) private readonly kafkaClient: ClientKafka) {
        const client = this.kafkaClient.createClient<Kafka>();
        this.producer = client.producer();

        this.producer.connect().then(() => (this.isConnected = true));
    }

    public sendMessage(to: string | undefined, event: EventsEnum, data: DataResponse<unknown>): void {
        if (!Envs.kafka.kafkaIsConnect || !this.isConnected || !to) return;

        const message = new MessageDto(to, event, data);

        this.producer.send({ topic: 'message', messages: [{ value: JSON.stringify(message) }] });

        // topic "message" это название связи в kafka которую слушаю только те сервесы которым мы укажем какой топик слушать
    }
}
