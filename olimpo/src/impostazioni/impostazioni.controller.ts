import { Body, Controller, Get, HttpException, HttpStatus, Put, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ImpostazioniService } from './impostazioni.service';
import { FotoAttributes } from 'src/models/foto.model';

@Controller('impostazioni')
export class ImpostazioniController {

    /**
     *
     */
    constructor(private impostazioniService: ImpostazioniService) {
    
    }

    @Get('getAllFoto')
    async getAllFoto(@Res() res: FastifyReply) {
        try {
            res.header('Cache-Control', 'no-store');
            return res.send(await this.impostazioniService.getAllFoto());
        } catch (error) {
            // Handle the error appropriately
            throw new HttpException('Error fetching all photos',HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('getFotoPage')
    async getFotoPage(
        @Query('offset') offset: string | undefined,
        @Query('limit') limit: string | undefined,
        @Query('q') search: string | undefined,
        @Res() res: FastifyReply,
    ) {
        try {
            res.header('Cache-Control', 'no-store');
            return res.send(await this.impostazioniService.getFotoPage({
                offset,
                limit,
                search,
            }));
        } catch (error) {
            throw new HttpException('Error fetching photo page', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put('updateFoto')
    async updateFoto(
        @Body() fotoAttributes: FotoAttributes,

    ) {
        try {
            return await this.impostazioniService.updateFoto(fotoAttributes.id,fotoAttributes);
        } catch (error) {
            // Handle the error appropriately
            throw new HttpException('Error updating photo',HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('getAllMateriali')
    async getAllMateriali(@Res() res: FastifyReply) {
        try {
            res.header('Cache-Control', 'no-store');
            return res.send(await this.impostazioniService.getAllMateriali());
        } catch (error) {
            // Handle the error appropriately
            throw new HttpException('Error fetching all materials',HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('getDashboardOverview')
    async getDashboardOverview(@Res() res: FastifyReply) {
        try {
            res.header('Cache-Control', 'no-store');
            return res.send(await this.impostazioniService.getDashboardOverview());
        } catch (error) {
            throw new HttpException('Error fetching dashboard overview', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    
    

}
