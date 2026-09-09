import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
  orgId?: string;
}

@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() q: { productId?: string; assigneeId?: string; sprintId?: string; status?: string; mine?: string }) {
    return this.tasks.list(req.user, { ...q, mine: q.mine === 'true' });
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER')
  create(@Req() req: AuthedRequest, @Body() dto: { productId: string; title: string; description?: string; assigneeId?: string; priority?: string; storyPoints?: number }) {
    return this.tasks.create(req.user, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.tasks.update(req.user, id, dto as never);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.tasks.softDelete(req.user, id);
  }
}
