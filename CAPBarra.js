// ==UserScript==
// @name        CAP (Comunio Automatic Payer)
// @namespace	https://gist.github.com/rubenlodi
// @description Reparte el dinero a tu comunidad segun la posición, los puntos y el 11 ideal.
// @include     http://www.comunio.es/team_news.phtml
// @version     1.0
// @author	Configurado por Gr1p3 para "La Barra", programado por dcordonu (https://gist.github.com/dcordonu), basado en el trabajo de Javyyk y Tulipy (https://greasyfork.org/scripts/2036-pagar-comunidad)
// @icon	http://cdn6.staztic.com/cdn/logos/comferzaciucomunio-23.png
// @require	http://code.jquery.com/jquery-1.8.2.min.js
// ==/UserScript==

var once_ideal = [];
var masterData = [];

///////////////////////////////////////////////////
/////////// VARIABLES PARA LOS PAGOS //////////////
///////////////////////////////////////////////////

/////////////////////// Posiciones premiadas ///////////////////////
var posiciones_premiadas = {};
// var posiciones_premiadas = {1 : 500000, 2 : 250000, 3 : 120000, -1 : 50000}; // Al resto de posiciones le damos 50000

///////////////////////// Valor de cada punto /////////////////////// 
var premio_punto = 120000;
// var premio_punto = 10000; // Doblamos el premio repartido por la maquina

///////////////////////// Premio por cada jugador en el once ideal/////////////
// var premio_ideal = 0 // No entregamos dinero por tener jugadores en el 11 ideal
var premio_ideal = 500000; // Premio entregado por cada jugador en el 11 ideal

/////////////////////// Penalizacion por tener mas jugadores del maximo permitido
var maximo_numero_jugadores_permitidos = 20;
var porcentaje_tasa_de_lujo_por_jugador = 10; // A partir de 21+ jugadores, se penalizara un 10% del premio final. Asi, al llegar a 30 no se ganara nada y con 31+ se perdera dinero cada jornada

//////////////////////////////////////////////////////////////

// Panel de control
var barra = '<div id="pago_div" class="article_header2"><a href="javascript:void(0);" id="boton_pagar" class="newbutton new_message_btn">Pagar Comunidad</a></div>';
$('#postwrap').prepend(barra);
var cartel = document.getElementById('pago_div');
$('#boton_pagar').bind('click', confirmEmpezarPagos);

/// fin de Barra de progreso  
////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////
// Repartir dinero //
/////////////////////

GM_registerMenuCommand('PAGAR Comunidad', confirmEmpezarPagos);

function confirmEmpezarPagos() {
	if (confirm('¿Deseas hacer el Reparto de Premios?')) {
        fillMasterData(empezarPagos(function() {
        // Informamos de los pagos
        window.setTimeout(
            (function() {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'http://www.comunio.es/team_news.phtml?postMessage_x=34',
                    data: 'newsAction=messageSubmitted&nid=3443067700&message=' + 'PAGOS EFECTUADOS' + '&cancel=-1&send_x=33&tinymce=true',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
            })
            , 5000);
    
            // Vamos a Noticias
            window.setTimeout((function() {
                location.href='http://www.comunio.es/team_news.phtml';
            })
            , 10000);
        }));
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Rellena la variable masterData con todo lo necesario para el computo del premio. Modificar segun se necesite. //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function fillMasterData(callback) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'http://www.comunio.es/standings.phtml?currentweekonly_x=22',
        synchronous: 'true',
        onload: function(r) {
            $(r.responseText).find('#tablestandings').find('tr').each(function(index) {
                if (index == 0) {
                    return; // nos saltamos el encabezado
                }
                
                var userData = {};
                var userPoints = $(this).find('td').eq(2).text() === '-' ? -1 : $(this).find('td').eq(2).text();
                
                userData.id = $(this).find('td').eq(1).find('a').attr('href').match(/[0-9]{3,}/gi);                       
                userData.puntos = userPoints;
                userData.nombre = $(this).find('td').eq(1).text();
                userData.posicion = index;
                
                masterData.push(userData);
            });
            
            callback();
        }
    });
}

//////////////////////////////////////////
// Extrae los jugadores de cada usuario //
//////////////////////////////////////////

function getUserPlayers(userId, callback) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'http://www.comunio.es/playerInfo.phtml?pid=' + userId,
        synchronous: 'true',
        onload: function(z) {
            var jugadoresDelUsuario = [];
            
            $(z.responseText).find('#contentfullsizeib').find('.name_cont').each(function() {
                jugadoresDelUsuario.push($(this).text());
            });
            
            callback(jugadoresDelUsuario);
        }
    });
}

function empezarPagos(callback) {
	cartel.innerHTML = 'PROCESANDO...';

	GM_xmlhttpRequest({
		method : 'GET',
		url : 'http://www.calculapuntoscomunio.com/once_ideal/',
		synchronous : 'true',
		onload : function(z) {
			$(z.responseText).find('#plantilla').find('.nombre').each(function() {
				once_ideal.push($(this).text().replace(/([\ \t]+(?=[\ \t])|^\s+|\s+$)/g, ''));
			});
			
            // Una vez obtenido el once ideal, recuperamos los jugadores de cada usuario y lanzamos el calculo, uno a uno
            masterData.forEach(function(userData) {
                getUserPlayers(userData.id, function(jugadoresDelUsuario) {
                    userData.jugadores = jugadoresDelUsuario;
                    comparar(userData);
                });
            });
            
            callback();
		}
	});
}

///////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////
// Compara los jugadores con el 11 ideal y cuenta cuantos tiene cada uno //
///////////////////////////////////////////////////////////////////////////

function comparar(userData) {
    var jugadoresDelUsuario = userData.jugadores;
    var totalJugadoresEnOnceIdeal = 0;
    
    once_ideal.forEach(function(jugador_once_ideal) {
        if (!jugadoresDelUsuario.indexOf(jugador_once_ideal) < 0) {
            totalJugadoresEnOnceIdeal += 1;
        }
    });

	calculo(userData, totalJugadoresEnOnceIdeal);
}

//////////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////
// Calcula el dinero que le corresponde a cada jugador //
/////////////////////////////////////////////////////////


function calculo(userData, totalJugadoresEnOnceIdeal) {
    var userId = userData.id;
    var userName = userData.nombre;
    var userPoints = userData.puntos;
    var userPosition = userData.posicion;
    var userPlayers = userData.jugadores.length;
    
	var premio = 0;

    // Premios por posicion
    premio += findPremioPorPosicion(userPosition);
    
    // Premio por jugadores en el once ideal
    premio += premio_ideal * totalJugadoresEnOnceIdeal;
    
    // Premio por puntos
    premio += userPoints * premio_punto;
    
    // Penalizacion por exceso de jugadores
    var jugadoresEnExceso = (userPlayers - maximo_numero_jugadores_permitidos) > 0 ? userPlayers - maximo_numero_jugadores_permitidos : 0;
    premio -= jugadoresEnExceso * porcentaje_tasa_de_lujo_por_jugador * premio / 100;
 
	pagar(userId, premio);
}

//////////////////////////////////////////////////////////////////////////////////

//////////////////////////
// Realiza los ingresos //
//////////////////////////

function pagar(userId, premio) {
    GM_xmlhttpRequest({
        method: 'POST',
        url: 'http://www.comunio.es/administration.phtml?penalty_x=33',
        data: 'newsDis=messageDis&pid_to=' + userId + '&amount=' + premio + '&cancel=-1&send_x=33',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//FUNCIONES EXTRA

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////
// Recupera el premio a dar segun la posicion del jugador //
////////////////////////////////////////////////////////////

function findPremioPorPosicion(userPosition) {
    return posiciones_premiadas[userPosition] || posiciones_premiadas[-1] || 0;
}

///////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////
// Cambia Formato De los Premios //
///////////////////////////////////

var formatNumber = {
	separador : '.', // separador para los miles
	sepDecimal : ',', // separador para los decimales
	formatear : function (num) {
		num += '';
		var splitStr = num.split('.');
		var splitLeft = splitStr[0];
		var splitRight = splitStr.length > 1 ? this.sepDecimal + splitStr[1] : '';
		var regx = /(\d+)(\d{3})/;
		while (regx.test(splitLeft)) {
			splitLeft = splitLeft.replace(regx, '$1' + this.separador + '$2');
		}

		return this.simbol + splitLeft  +splitRight;
	},
	new : function(num, simbol) {
		this.simbol = simbol || '';

		return this.formatear(num);
	}
};
