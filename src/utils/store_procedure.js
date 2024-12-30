
/*  Module: Packers
*   Update condition based on is_quality_checked
*/  

/*
DELIMITER //

CREATE PROCEDURE UpdateQualityCheck(IN replicator_num INT(10))
BEGIN
    IF (SELECT COUNT(*) FROM serial_number WHERE replicator_id = replicator_num AND is_quality_checked = 'No') = 0 THEN
        UPDATE ine_replicator
        SET is_quality_checked = 'Yes'
        WHERE id = replicator_num;
    END IF;
END //

DELIMITER ;

*/

/*  Module: Packers
*   Update condition based on is_packed
*/  

/*
DELIMITER //

CREATE PROCEDURE UpdatePackingCheck(IN replicator_num INT(10))
BEGIN
    IF (SELECT COUNT(*) FROM serial_number WHERE replicator_id = replicator_num AND is_packed = 'No') = 0 THEN
        UPDATE ine_replicator
        SET is_packed = 'Yes'
        WHERE id = replicator_num;
    END IF;
END //

DELIMITER ;

*/