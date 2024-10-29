import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ChatsService } from '../services/chats.service';
import { CreateOpenChatDto } from '../dto/requests/create-open-chat.dto';
import { QueryGetChatsDto } from '../dto/requests/query-get-chats.dto';
import { ChatEntity } from '../entities/chat.entity';

@Controller('chats')
export class ChatsController {
    constructor(private readonly chatsService: ChatsService) {}
    @ApiOkResponse({
        type: ChatEntity,
    })
    @Post()
    createChat(@Body() body: CreateOpenChatDto): Promise<ChatEntity> {
        return this.chatsService.createOpenChat(body.title);
    }

    @ApiOkResponse({
        type: ChatEntity,
        isArray: true,
    })
    @Get()
    async getChats(@Query() query: QueryGetChatsDto): Promise<ChatEntity[]> {
        return await this.chatsService.getOpenChats(query.title, query.offset, query.limit);
    }

    @Get(':id')
    async getChat(@Param('id') id: number): Promise<string | ChatEntity> {
        return this.chatsService.findChat(id);
    }
}
