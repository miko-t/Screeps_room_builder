module.exports = class buildingPlacement{
    /** @param {Room} room **/
constructor(map, room){
    this.map = map;
    this.buildings = {
        spawn : { ids : [] },
        extension : { ids : [] },
        lab : { ids : [] },
        link : { ids : [] },
        nuker : { ids : [] },
        storage : { ids : [] },
        terminal : { ids : [] }, 
        tower : { ids : [] }, 
        powerSpawn : { ids : [] },
        observer : { ids : [] },
        factory : { ids : [] },
    };
    
    this.all = [];
    //let start = 0;
    for(let i in map.buildings){
        let tile = map.buildings[i]; 
        tile.index = tile.x * 50 + tile.y;
        this.all.push(tile);
    }

    this.open = map.buildings;
    this.roads = map.roads;
    this.center = map.base;
    this.final = {};
    this.inbase = {};
    this.terrain = room.getTerrain();
    this.room = room;
    this.circ = this.size * 4;

    let remove_arr = [];
    let sources = room.find(FIND_SOURCES);
    for(let i in this.open){
        let tile = this.open[i];
        if(tile.id)
            continue;
        for(let i in sources){
            let source = sources[i];
            let distance = this.distance(source.pos.x, source.pos.y, tile.x, tile.y);
            if(distance <= 5){
                    remove_arr.push(tile);
                break;
            }
        }
    }

    this.existing = map.existing;
    this.connect_targets =  [];
    for(let i in map.existing){
        let tile = map.existing[i];
        if(tile.type != 'controller')
            this.final[tile.index] = tile;
        this.connect_targets.push(room.getPositionAt(tile.x, tile.y));
    }
    for(let i in remove_arr){
        this.remove_tile(remove_arr[i]);
    }
}

set_building(tile, type){
    tile.type = type;
    this.buildings[type].ids.push(tile.index);
    this.final[tile.index] = tile;
}

/** @param {RoomPosition} pos **/
get_near_side(arr){
    let ret = [];
    for(let pos of arr){
        this.add_inRange(pos, (x, y) => {
            if(this.terrain.get(x,y) != 1){
                ret.push(this.room.getPositionAt(x, y));
            }
        })
    }
    return ret;
}

close_data(){
    this.roads = this.create_roads();
    let sources = this.room.find(FIND_MINERALS);
    sources = sources.concat(this.room.find(FIND_SOURCES));

    let ex = [];
    let cpos = this.room.getPositionAt(this.center.x, this.center.y);
    for(let i = 1; i <= 7; i += 2){
        let exits = this.room.find(i);
        if(!exits.length)
            continue;
        exits = this.get_near_side(exits);
        let exit = cpos.findClosestByPath(exits, { ignoreRoad : true, swampCost : 1 });
        if(exit){
            ex.push(exit);
        }
    }
    //console.log(ex, "exits");

    let ret = {};
    sources = sources.concat(this.connect_targets);
    sources = sources.concat(ex);
    sources = this.conncet_neighbours(sources);

    this.connect_roads(sources, this.roads, ret);
    //this.connect_roads(sources, this.roads, this.roads);
    //this.connect_roads(sources, ret, this.roads);
    
    for(let i in ret){
        let tile = ret[i];
        this.roads[tile.index] = tile;
    }

    for(let pos of ex){
        let index = pos.x * 50 + pos.y;
        this.roads[index] = { x : pos.x, y : pos.y, index : index };
    }

    let x = this.center.x;
    let y = this.center.y;
    this.roads =  Object.values(this.roads).sort((a, b) => {
        return this.distance(a.x, a.y, x, y) - this.distance(b.x, b.y, x, y);
    });
}

/** @param {RoomPosition[]} arr **/
conncet_neighbours(arr = []){
    let ret = [];
    let saved = {};
    this.ob = {};
    for(let i = 0; i < arr.length; i++){
        let pos = arr[i];
        if(!(pos instanceof RoomPosition)){
            pos = pos.pos;
        }
        if(saved[pos.x *2 + pos.y]){
            continue;
        }
        for(let k = i + 1; k < arr.length; k++){
            let posb = arr[k];
            if(!(posb instanceof RoomPosition)){
                posb = posb.pos;
            }
            if(pos.x == posb.x && posb.y == pos.y)
                continue;
            if(pos.getRangeTo(posb) <= 2){
                let range = 50000;
                let add = null;
                this.add_inRange(pos, (x, y) => {
                    if(x == pos.x && y == pos.y || x == posb.x && y == posb.y)
                        return;
                    if(this.terrain.get(x,y) != 1){
                        if(posb.getRangeTo(x, y) == 1){
                            saved[pos.x * 2 + pos.y] = true;
                            saved[posb.x * 2 + posb.y] = true;
                            let dist = this.distance(x, y, this.center.x, this.center.y);
                            if(dist < range){
                                add = this.room.getPositionAt(x, y);
                                range = dist;
                            }
                        }
                    }
                })
                if(add){
                    ret.push(add);
                }
            }
        }
        if(saved[pos.x *2 + pos.y]){
            continue;
        }
        saved[pos.x *2 + pos.y] = true;
        ret.push(pos);
    }
    return ret;
}

/** @param {RoomPosition[]} arr **/
connect_roads(arr = [], roads = {}, ret = {}){
    for(let pos of arr){
        let r = null;
        let sdist = 10000;
        for(let j in roads){
            let tile = roads[j];
            let dist = this.distance(pos.x, pos.y, tile.x, tile.y);
            if(sdist >= dist && dist > 2){
                sdist = dist;
                r = tile;
            }
        }

        for(let rpos of pos.findPathTo(r.x, r.y, { ignoreRoad : true, swampCost : 1, reusePath : 25 })){
            let index = rpos.x * 50 + rpos.y;
            if(this.final[index])
                break;
            ret[index] = { x : rpos.x, y : rpos.y, index : index };
        }
        
        let ir = pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType == 'road').length;
        if(pos.look().length <= 1 + ir){
            let index = pos.x * 50 + pos.y;
            ret[index] = { x : pos.x, y : pos.y, index : index };
        }
    }
}

create_roads(){
    let arr = {};
    for(let i in this.final){
        let tile = this.final[i];
        if(tile.outside)
            continue;
        this.add_inRange(tile, (x, y) => {
            if(this.terrain.get(x, y) == 1)
                return;
            let index = x * 50 + y;
            let t = this.final[index];
            if(!t){
                arr[index] = { x : x, y : y, index : index };
            }
        })
    } 
    return arr;
}

add_inRange(tile, to_do){
    for(let _gridY = -1; _gridY < 2; _gridY++){
        for(let _gridX = -1; _gridX < 2; _gridX++){
            let x1 = _gridX + tile.x;
            let y1 = _gridY + tile.y;
            if(y1 >= 49 || x1 >= 49 || x1 < 1 || y1 < 1)
                continue;
            to_do(x1, y1);
        }
    }
}

set_arr(arr, arr_type){
    for(let i in arr){
        let type = arr_type[i];
        let tile = arr[i];
        this.set_building(tile, type);
        this.remove_tile(tile);
    }
}

get_road_inrange(x, y, r){
    let arr = [];
    for(let i in this.roads){
        let road = this.roads[i];
        if(this.distance(x, y, road.x, road.y) <= r){
            arr.push(road);
        }
    }
    return arr;
}

get_type(itype, single = true){
    let ret = [];
    for(let i in this.open){
        let t = this.open[i];
        if(t.type == itype){
            if(single){
                return t;
            }
            ret.push(t);
        }
    }
    if(single){
        return null;
    }
    return ret;
}

get_types(arr){
    let ret = [];
    let del = [];
    for(let i in this.open){
        let found = false;
        let t = this.open[i];
        for(let type of arr){
            if(t.type == type){
                ret.push(t);
                del.push(type);
            }
        }
    }

    for(let d of del){
        let id = arr.indexOf(d);
        if(id >= 0)
            arr.splice(id, 1);
    }

    return ret;
}

get_roads_from(arr){
    let ret = {}
    let p = 0;

    let types = {};
    for(let t of arr){
        if(!types[t.type]){
            p++;
            types[t.type] = true;
        }
        for(let r of this.get_road_inrange(t.x, t.y, 3)){
            if(ret[r.index]){
                ret[r.index].n++;
            }else{
                ret[r.index] = { n : 1, road : r };
            }
        }
    }

    let rr = [];
    for(let r in ret){
        let o = ret[r];
        if(o.n >= p){
            rr.push(o.road);
        }
    }
    return rr;
}

remove_tile(tile){
    let id = this.open.indexOf(tile);
    if(id >= 0){
        //this.final[tile.index] = tile;
        this.open.splice(id, 1);
    }
}

get_closest(count, max_range, itype, set, in_list){
    if(count == 0)
        return null;

    if(!in_list)
        in_list = this.roads;
    for(let i in in_list){
        let r = in_list[i];
        let get = this.get_closest_to(r.x, r.y, count, itype);
        if(get && get.ranges[count - 1].d <= max_range){
            if(set && itype){
                return this.set_tiles(get.obj, itype);
            }
            return get.obj;
        }
    }
    return null;
}

get_closest_to(x, y, count, itype, set){
    let arr = [];
    let ex = [];
    for(let i in this.open){
        let tile = this.open[i];
        if(tile.type){
            if(tile.type == itype){
                arr.push({ id : i, d : 0 });
            }
            continue;
        }
        let dist = this.distance(x, y, tile.x, tile.y);
        arr.push({ id : i, d : dist });
    }
    if(arr.length == 0){
        return null;
    }

    arr.sort((a, b) => a.d - b.d);
    arr = arr.slice(0, count);
    arr = arr.concat(ex);

    let ret= [];
    for(let i in arr){
        ret.push(this.open[arr[i].id]);
    }
    if(set && itype)
        return this.set_tiles(ret, itype);
    return { ranges : arr, obj : ret };
}

set_tiles(tiles, type){
    if(!type)   
        return;
    for(let i in tiles){
        let tile = tiles[i];
        this.set_building(tile, type);
        this.remove_tile(tile);
    }
    return tiles;   
}

update_tiles(tiles){
    for(let i in tiles){
        let tile = tiles[i];
        this.set_building(tile, tile.type);
        this.remove_tile(tile);
    }
}

checkOverlaping_v2(in_arr = [], include = [], overlaps, radius, count, type, ignore_list = null){
    let search_arr = in_arr;
    if(!ignore_list){
        ignore_list = {};
        if(include.length > 0){
            search_arr = include;
        }
    }
    for(let i in search_arr){
        let tile = search_arr[i];
        if(ignore_list[tile.index] || tile.type && tile.type != type){
            continue;
        }
        let arr = this.get_withinRange(in_arr, tile, radius, type);
        if(arr.length >= count){
            if(!this.check_includes(arr, include)){
                continue;
            }

            if(overlaps <= 1){
                arr = arr.slice(0, count);
                console.log('generated overlaping area of buildings!', type);
                return this.set_tiles(arr, type);
            }else{
                ignore_list[tile.index] = true;
                let found = this.checkOverlaping_v2(arr, include, overlaps - 1, radius, count, type, ignore_list);
                if(found)
                    return found;
            }
        }
    }
    return null;
}

check_includes(arr = [], include_arr = []){
    if(include_arr.length == 0){
        return true;
    }
    for(let i of include_arr){
        if(!arr.includes(i)){
            return false;
        }
    }
    return true;
}

get_withinRange(arr, tile, r, type){
    let ignore_list = {};
    let ret = [];
    ret.push(tile);
    for(let i in arr){
        let t = arr[i];
        if(ignore_list[t.index] || t == tile || (t.type && t.type != type)) 
            continue;
        ignore_list[t.index] = true;
        let d = this.tile_distance(t, tile);
        if(d <= r){
            t.range = d;
            ret.push(t);
        }
    }
    //console.log(ret.length);
    return ret;
}

tile_distance(tileA, tileB){
    return (tileA.x - tileB.x) ** 2 + (tileA.y - tileB.y) ** 2;
}

distance(x1, y1, x2, y2){
    return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}
}