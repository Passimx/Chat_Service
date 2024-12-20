import { Entity, Enum, Index, OneToMany, Property } from '@mikro-orm/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatedEntity } from '../../../common/entities/created.entity';
import { ChatTypeEnum } from '../types/chat-type.enum';
import { MessageEntity } from './message.entity';

@Entity({ tableName: 'chats' })
@Index({ type: 'GIN', properties: 'title' })
export class ChatEntity extends CreatedEntity {
    @ApiProperty()
    @Property()
    readonly title: string;

    @ApiProperty()
    @Property({ default: 0 })
    countMessages!: number;

    @ApiProperty()
    @Property({ nullable: true })
    readonly createdUserId!: number;

    @ApiProperty()
    @Enum({ default: ChatTypeEnum.IS_OPEN, items: () => ChatTypeEnum, nativeEnumName: 'chat_type_enum' })
    readonly type!: ChatTypeEnum;

    constructor(title: string) {
        super();

        this.title = title;
    }

    @ApiPropertyOptional({ type: () => MessageEntity, isArray: true })
    @OneToMany(() => MessageEntity, (message) => message.chat)
    readonly messages!: MessageEntity[];
}
