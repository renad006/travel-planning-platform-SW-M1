import { PartialType } from '@nestjs/swagger';
import { CreateAirlineDto } from './create-airline.dto';

/** FLT-01 (moderator edits name / code). Nothing else is editable here. */
export class UpdateAirlineDto extends PartialType(CreateAirlineDto) {}
