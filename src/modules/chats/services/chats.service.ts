import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { ChatEntity } from '../entities/chat.entity';
import { DataResponse } from '../../../common/swagger/data-response.dto';
import { EventsEnum } from '../../queue/types/events.enum';
import { QueueService } from '../../queue/queue.service';
import { MessageTypeEnum } from '../types/message-type.enum';
import { MessageErrorLanguageEnum } from '../types/message-error-language.enum';
import { SystemMessageLanguageEnum } from '../types/system-message-language.enum';
import { ChatTypeEnum } from '../types/chat-type.enum';
import { TopicsEnum } from '../../queue/types/topics.enum';
import { MessageEntity } from '../entities/message.entity';
import { ChatsDto, FavoriteChat } from '../dto/requests/post-favorites-chat.dto';
import { MessagesService } from './messages.service';

@Injectable()
export class ChatsService {
    constructor(
        @InjectRepository(MessageEntity)
        readonly messageRepository: EntityRepository<MessageEntity>,
        @InjectRepository(ChatEntity)
        private readonly chatRepository: EntityRepository<ChatEntity>, // chatRepository - это объект для запросов в бд
        private readonly queueService: QueueService,
        private readonly messagesService: MessagesService,
    ) {}

    async createOpenChat(title: string, socketId: string): Promise<DataResponse<ChatEntity>> {
        const chatEntity = new ChatEntity(title);

        await this.chatRepository.insert(chatEntity);

        await this.messagesService.createMessage(
            chatEntity.id,
            MessageTypeEnum.IS_SYSTEM,
            undefined,
            SystemMessageLanguageEnum.create_chat,
            undefined,
        );
        const createChat = await this.chatRepository.findOne({ id: chatEntity.id }, { populate: ['message'] });

        const response = new DataResponse<ChatEntity>(createChat!);
        this.queueService.sendMessage(TopicsEnum.EMIT, socketId, EventsEnum.CREATE_CHAT, response);
        const chatId: string[] = [chatEntity.id];

        this.queueService.sendMessage(
            TopicsEnum.JOIN,
            socketId,
            EventsEnum.JOIN_CHAT,
            new DataResponse<string[]>(chatId),
        );

        return response;
    }

    async getOpenChats(
        title: string,
        offset: number,
        limit?: number,
        notFavoriteChatIds?: string[],
    ): Promise<DataResponse<ChatEntity[]>> {
        if (title) {
            const queryWords = title.toLowerCase().split(' ');
            const arrayWords = queryWords.map((word) => ({
                $or: [{ title: { $ilike: `${word}%` } }, { title: { $ilike: `% ${word}%` } }],
            }));
            const getChatTitle = await this.chatRepository.find(
                {
                    $and: arrayWords,
                    id: { $nin: notFavoriteChatIds },
                },
                {
                    limit,
                    offset: offset,

                    orderBy: { title: 'ASC', message: { createdAt: 'DESC NULLS LAST' } },
                    populate: ['message'],
                },
            );

            return new DataResponse(getChatTitle);
        } else {
            const getChatNotTitle = await this.chatRepository.find(
                { id: { $nin: notFavoriteChatIds } },
                {
                    limit,
                    offset: offset,
                    orderBy: { message: { createdAt: 'DESC NULLS LAST' } },
                    populate: ['message'],
                },
            );

            return new DataResponse(getChatNotTitle);
        }
    }

    async findChat(id: string): Promise<DataResponse<string | ChatEntity>> {
        const chat = await this.chatRepository.findOne(id, {
            orderBy: {
                message: { createdAt: 'DESC NULLS LAST' },
            },
            populate: ['message'],
        });

        if (chat) {
            return new DataResponse(chat);
        }

        return new DataResponse(MessageErrorLanguageEnum.CHAT_WITH_ID_NOT_FOUND);
    }

    async favoriteChats(chatsMap: ChatsDto[], socketId: string): Promise<DataResponse<string | FavoriteChat[]>> {
        const response: FavoriteChat[] = [];
        const responseChat: string[] = [];
        const uniqueChatIds = new Set<string>();

        const promises = chatsMap.map(async ({ chatId, lastMessage }) => {
            const chat = await this.chatRepository.findOne(
                { id: chatId, type: ChatTypeEnum.IS_OPEN },
                {
                    orderBy: { message: { createdAt: 'DESC NULLS LAST' } },
                    populate: ['message'],
                },
            );

            if (!chat) {
                return;
            }

            responseChat.push(chatId);

            if (chat.countMessages <= lastMessage) {
                return;
            }

            const lastMessageEntity = chat.message;

            if (lastMessageEntity && !uniqueChatIds.has(chatId)) {
                uniqueChatIds.add(chatId);

                return new FavoriteChat(chatId, lastMessageEntity);
            }

            return;
        });

        const results = await Promise.allSettled(promises);

        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
                response.push(result.value);
            }
        });

        const responseChats = new DataResponse<string[]>(responseChat);
        this.queueService.sendMessage(TopicsEnum.JOIN, socketId, EventsEnum.JOIN_CHAT, responseChats);

        return new DataResponse<FavoriteChat[]>(response);
    }

    async leaveChats(chatIds: string[], socketId: string): Promise<DataResponse<string[]>> {
        const filterLeaveChat = await this.chatRepository.find({
            id: { $in: chatIds },
        });

        const chatIdsFound = filterLeaveChat.map((chat) => chat.id);
        const response: DataResponse<string[]> = new DataResponse<string[]>(chatIdsFound);
        this.queueService.sendMessage(TopicsEnum.LEAVE, socketId, EventsEnum.JOIN_CHAT, response);

        return response;
    }
}
